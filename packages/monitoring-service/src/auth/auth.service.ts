import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { DataSource, IsNull, Repository } from 'typeorm';

import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { AuthenticatedUser, AuthResult } from './auth.types';

const ACCESS_TOKEN_AUDIENCE = 'monitoring-service';
const ACCESS_TOKEN_ISSUER = 'wfh-attendance';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const MAX_TRACKED_LOGIN_KEYS = 5000;
const BCRYPT_COST = 12;

interface RotatedToken {
  kind: 'rotated';
  user: User;
  refreshToken: string;
}

interface RejectedToken {
  kind: 'invalid' | 'reused';
}

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET_MONITORING;
  private readonly accessTokenTtlSeconds = this.getAccessTokenTtlSeconds();
  private readonly dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString('hex'), BCRYPT_COST);
  private readonly failedLoginAttempts = new Map<string, number[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET_MONITORING must be configured.');
    }

    if (process.env.NODE_ENV === 'production' && this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET_MONITORING must be at least 32 characters in production.');
    }
  }

  async login(email: string, password: string, ipAddress: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const attemptKey = `${ipAddress}\u0000${normalizedEmail}`;
    this.assertLoginAllowed(attemptKey);

    const user = await this.users.findOne({
      where: { email: normalizedEmail },
      relations: { employee: true },
    });
    const passwordFitsBcrypt = Buffer.byteLength(password, 'utf8') <= 72;
    const passwordMatches = await bcrypt.compare(
      passwordFitsBcrypt ? password : randomBytes(32).toString('hex'),
      user?.passwordHash ?? this.dummyPasswordHash,
    );

    if (
      !user ||
      user.deletedAt ||
      !user.isActive ||
      user.role !== UserRole.HRD_ADMIN ||
      !passwordFitsBcrypt ||
      !passwordMatches
    ) {
      this.recordFailedLogin(attemptKey);
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.failedLoginAttempts.delete(attemptKey);
    user.lastLoginAt = new Date();
    await this.users.save(user);
    return this.createSession(user);
  }

  async refresh(rawToken?: string): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is missing or invalid.');
    }

    const tokenHash = this.hashToken(rawToken);
    const rotation = await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(RefreshToken);
      const userRepository = manager.getRepository(User);
      const token = await tokenRepository.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!token) {
        return { kind: 'invalid' } satisfies RejectedToken;
      }

      if (token.revokedAt) {
        await tokenRepository.update(
          { familyId: token.familyId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return { kind: 'reused' } satisfies RejectedToken;
      }

      const user = await userRepository.findOne({
        where: { id: token.userId },
        relations: { employee: true },
        withDeleted: true,
      });

      if (
        token.expiresAt.getTime() <= Date.now() ||
        !user ||
        user.deletedAt ||
        !user.isActive ||
        user.role !== UserRole.HRD_ADMIN
      ) {
        await tokenRepository.update(
          { familyId: token.familyId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return { kind: 'invalid' } satisfies RejectedToken;
      }

      const refreshToken = this.createRefreshToken();
      token.revokedAt = new Date();
      await tokenRepository.save(token);
      await tokenRepository.save(
        tokenRepository.create({
          id: ulid(),
          userId: user.id,
          tokenHash: this.hashToken(refreshToken),
          familyId: token.familyId,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          revokedAt: null,
        }),
      );

      return { kind: 'rotated', user, refreshToken } satisfies RotatedToken;
    });

    if (rotation.kind !== 'rotated') {
      throw new UnauthorizedException('Refresh token is missing or invalid.');
    }

    return this.createAuthResult(rotation.user, rotation.refreshToken);
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.refreshTokens.update(
      { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    this.assertPasswordLength(currentPassword);
    this.assertPasswordLength(newPassword);

    await this.dataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const tokenRepository = manager.getRepository(RefreshToken);
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect.');
      }

      user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      user.mustChangePassword = false;
      await userRepository.save(user);
      await tokenRepository.update(
        { userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });
  }

  private async createSession(user: User): Promise<AuthResult> {
    const refreshToken = this.createRefreshToken();
    await this.refreshTokens.save(
      this.refreshTokens.create({
        id: ulid(),
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId: ulid(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      }),
    );

    return this.createAuthResult(user, refreshToken);
  }

  private async createAuthResult(user: User, refreshToken: string): Promise<AuthResult> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role, jti: ulid() },
      {
        secret: this.jwtSecret,
        audience: ACCESS_TOKEN_AUDIENCE,
        issuer: ACCESS_TOKEN_ISSUER,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );

    return {
      accessToken,
      refreshToken,
      user: this.toAuthenticatedUser(user),
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      employee: user.employee
        ? {
            id: user.employee.id,
            fullName: user.employee.fullName,
            department: user.employee.department,
            position: user.employee.position,
          }
        : null,
    };
  }

  private assertLoginAllowed(attemptKey: string): void {
    const activeAttempts = (this.failedLoginAttempts.get(attemptKey) ?? []).filter(
      (attemptedAt) => Date.now() - attemptedAt < LOGIN_ATTEMPT_WINDOW_MS,
    );

    if (activeAttempts.length >= MAX_FAILED_LOGIN_ATTEMPTS) {
      this.failedLoginAttempts.set(attemptKey, activeAttempts);
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (activeAttempts.length === 0) {
      this.failedLoginAttempts.delete(attemptKey);
    } else {
      this.failedLoginAttempts.set(attemptKey, activeAttempts);
    }
  }

  private recordFailedLogin(attemptKey: string): void {
    if (!this.failedLoginAttempts.has(attemptKey)) {
      if (this.failedLoginAttempts.size >= MAX_TRACKED_LOGIN_KEYS) {
        const oldestKey = this.failedLoginAttempts.keys().next().value;
        if (oldestKey) {
          this.failedLoginAttempts.delete(oldestKey);
        }
      }
      this.failedLoginAttempts.set(attemptKey, []);
    }

    const attempts = this.failedLoginAttempts.get(attemptKey);
    if (attempts) {
      attempts.push(Date.now());
    }
  }

  private createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertPasswordLength(password: string): void {
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException(
        'Password must be at least 8 characters and no more than 72 UTF-8 bytes.',
      );
    }
  }

  private getAccessTokenTtlSeconds(): number {
    const configuredTtl = process.env.JWT_ACCESS_TTL ?? '15m';
    const ttlMatch = /^(\d+)(s|m|h|d)$/.exec(configuredTtl);

    if (!ttlMatch) {
      throw new Error('JWT_ACCESS_TTL must be a duration such as 15m, 1h, or 1d.');
    }

    const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 } as const;
    const ttlSeconds = Number(ttlMatch[1]) * unitSeconds[ttlMatch[2] as keyof typeof unitSeconds];
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1) {
      throw new Error('JWT_ACCESS_TTL must be a positive duration.');
    }

    return ttlSeconds;
  }
}
