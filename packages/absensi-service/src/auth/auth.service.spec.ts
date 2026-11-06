import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { AuthService } from './auth.service';

describe('Absensi AuthService', () => {
  let service: AuthService;
  let users: {
    findOne: Mock;
    save: Mock;
  };
  let refreshTokens: {
    create: Mock;
    save: Mock;
    update: Mock;
  };
  let jwtService: { signAsync: Mock };
  let dataSource: { transaction: Mock };

  beforeEach(() => {
    process.env.JWT_SECRET_ABSENSI = 'test-secret-that-is-long-enough-for-unit-testing';
    process.env.JWT_ACCESS_TTL = '15m';
    users = { findOne: vi.fn(), save: vi.fn((user) => user) };
    refreshTokens = {
      create: vi.fn((token) => token),
      save: vi.fn((token) => token),
      update: vi.fn(),
    };
    jwtService = { signAsync: vi.fn().mockResolvedValue('signed-access-token') };
    dataSource = { transaction: vi.fn() };
    service = new AuthService(
      jwtService as unknown as JwtService,
      dataSource as unknown as DataSource,
      users as unknown as Repository<User>,
      refreshTokens as unknown as Repository<RefreshToken>,
    );
  });

  afterEach(() => {
    delete process.env.JWT_SECRET_ABSENSI;
    delete process.env.JWT_ACCESS_TTL;
  });

  it('creates a session only for an active employee with a correct password', async () => {
    const user = createUser(UserRole.EMPLOYEE, await bcrypt.hash('correct-password', 10));
    users.findOne.mockResolvedValue(user);

    const result = await service.login(user.email, 'correct-password', '127.0.0.1');

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBeTruthy();
    expect(result.user).toMatchObject({
      email: user.email,
      role: UserRole.EMPLOYEE,
      mustChangePassword: true,
    });
    expect(refreshTokens.save).toHaveBeenCalledTimes(1);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: user.id, role: UserRole.EMPLOYEE, jti: expect.any(String) }),
      expect.objectContaining({ audience: 'absensi-service', expiresIn: 900 }),
    );
  });

  it('rejects a valid password for an HRD admin with the generic login error', async () => {
    const user = createUser(UserRole.HRD_ADMIN, await bcrypt.hash('correct-password', 10));
    users.findOne.mockResolvedValue(user);

    await expect(
      service.login(user.email, 'correct-password', '127.0.0.1'),
    ).rejects.toThrow('Invalid email or password.');

    expect(refreshTokens.save).not.toHaveBeenCalled();
  });

  it('blocks the sixth failed login for the same IP and email', async () => {
    users.findOne.mockResolvedValue(null);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login('nobody@example.com', 'wrong-password', '127.0.0.1'),
      ).rejects.toThrow('Invalid email or password.');
    }

    await expect(
      service.login('nobody@example.com', 'wrong-password', '127.0.0.1'),
    ).rejects.toThrow('Too many login attempts.');
    expect(users.findOne).toHaveBeenCalledTimes(5);
  });

  it('rotates a refresh token while preserving its family', async () => {
    const user = createUser(UserRole.EMPLOYEE, await bcrypt.hash('correct-password', 10));
    const oldToken = createRefreshToken(user.id);
    const tokenRepository = {
      findOne: vi.fn().mockResolvedValue(oldToken),
      create: vi.fn((token) => token),
      save: vi.fn((token) => token),
      update: vi.fn(),
    };
    const userRepository = { findOne: vi.fn().mockResolvedValue(user) };
    dataSource.transaction.mockImplementation((operation) =>
      operation({
        getRepository: (entity: unknown) =>
          entity === RefreshToken ? tokenRepository : userRepository,
      }),
    );

    const result = await service.refresh('presented-refresh-token');

    expect(result.refreshToken).not.toBe('presented-refresh-token');
    expect(oldToken.revokedAt).toBeInstanceOf(Date);
    expect(tokenRepository.save).toHaveBeenCalledTimes(2);
    expect(tokenRepository.save.mock.calls[1][0].familyId).toBe(oldToken.familyId);
  });

  it('revokes the active family when a rotated refresh token is reused', async () => {
    const oldToken = createRefreshToken('user-id');
    oldToken.revokedAt = new Date();
    const tokenRepository = {
      findOne: vi.fn().mockResolvedValue(oldToken),
      update: vi.fn(),
    };
    dataSource.transaction.mockImplementation((operation) =>
      operation({ getRepository: () => tokenRepository }),
    );

    await expect(service.refresh('replayed-refresh-token')).rejects.toThrow(
      'Refresh token is missing or invalid.',
    );
    expect(tokenRepository.update).toHaveBeenCalledWith(
      { familyId: oldToken.familyId, revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });

  it('changes the password and revokes remaining refresh sessions', async () => {
    const user = createUser(UserRole.EMPLOYEE, await bcrypt.hash('current-password', 10));
    const userRepository = {
      findOne: vi.fn().mockResolvedValue(user),
      save: vi.fn((savedUser) => savedUser),
    };
    const tokenRepository = { update: vi.fn() };
    dataSource.transaction.mockImplementation((operation) =>
      operation({
        getRepository: (entity: unknown) =>
          entity === User ? userRepository : tokenRepository,
      }),
    );

    await service.changePassword(user.id, 'current-password', 'new-password');

    expect(user.mustChangePassword).toBe(false);
    expect(await bcrypt.compare('new-password', user.passwordHash)).toBe(true);
    expect(tokenRepository.update).toHaveBeenCalledWith(
      { userId: user.id, revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });
});

function createUser(role: UserRole, passwordHash: string): User {
  return {
    id: '01J00000000000000000000000',
    employee: null,
    email: 'employee@example.com',
    activeEmail: 'employee@example.com',
    passwordHash,
    role,
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function createRefreshToken(userId: string): RefreshToken {
  return {
    id: '01J00000000000000000000001',
    userId,
    tokenHash: 'stored-hash',
    familyId: '01J00000000000000000000002',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
    user: createUser(UserRole.EMPLOYEE, ''),
  };
}
