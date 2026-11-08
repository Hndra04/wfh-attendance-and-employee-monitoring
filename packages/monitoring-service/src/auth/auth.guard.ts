import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';

import { User, UserRole } from '../database/entities/user.entity';
import { AuthRequestUser } from './auth.types';

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly audience = 'monitoring-service';
  private readonly issuer = 'wfh-attendance';
  private readonly secret = process.env.JWT_SECRET_MONITORING;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    if (!this.secret) {
      throw new Error('JWT_SECRET_MONITORING must be configured.');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequestUser>();
    const token = this.getBearerToken(request);
    const payload = await this.verifyToken(token);
    if (typeof payload.sub !== 'string' || payload.role !== UserRole.HRD_ADMIN) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findOne({
      where: { id: payload.sub },
      relations: { employee: true },
    });

    if (!user || !user.isActive || user.role !== payload.role) {
      throw new UnauthorizedException();
    }

    request.user = {
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

    return true;
  }

  private getBearerToken(request: Request): string {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    return authorization.slice('Bearer '.length);
  }

  private async verifyToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.secret,
        audience: this.audience,
        issuer: this.issuer,
      });
    } catch {
      throw new UnauthorizedException();
    }
  }
}
