import 'reflect-metadata';

import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { User, UserRole } from '../database/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const authService = {
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
};
const jwtService = {
  verifyAsync: vi.fn().mockResolvedValue({ sub: 'admin-id', role: UserRole.HRD_ADMIN }),
};
const usersRepository = {
  findOne: vi.fn().mockResolvedValue({
    id: 'admin-id',
    email: 'admin@example.test',
    role: UserRole.HRD_ADMIN,
    isActive: true,
    mustChangePassword: false,
    employee: null,
  }),
};

Reflect.defineMetadata('design:paramtypes', [AuthService], AuthController);
Reflect.defineMetadata(
  'design:paramtypes',
  [LoginDto, Object, Object],
  AuthController.prototype,
  'login',
);
Reflect.defineMetadata('design:paramtypes', [Object, Object], AuthController.prototype, 'refresh');
Reflect.defineMetadata('design:paramtypes', [Object, Object], AuthController.prototype, 'logout');
Reflect.defineMetadata('design:paramtypes', [Object], AuthController.prototype, 'getCurrentUser');
Reflect.defineMetadata(
  'design:paramtypes',
  [Object, ChangePasswordDto, Object],
  AuthController.prototype,
  'changePassword',
);
Reflect.defineMetadata('design:paramtypes', [JwtService, Object], AuthGuard);

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AuthService, useValue: authService },
    AuthGuard,
    { provide: JwtService, useValue: jwtService },
    { provide: getRepositoryToken(User), useValue: usersRepository },
  ],
})
class AuthApiTestModule {}

describe('HRD auth API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
    authService.login.mockResolvedValue({
      accessToken: 'e2e-access-token',
      refreshToken: 'e2e-refresh-token',
      user: { id: 'admin-id', role: UserRole.HRD_ADMIN },
    });
    authService.refresh.mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      user: { id: 'admin-id', role: UserRole.HRD_ADMIN },
    });
    authService.logout.mockResolvedValue(undefined);
    authService.changePassword.mockResolvedValue(undefined);
    jwtService.verifyAsync.mockResolvedValue({ sub: 'admin-id', role: UserRole.HRD_ADMIN });
    usersRepository.findOne.mockResolvedValue({
      id: 'admin-id',
      email: 'admin@example.test',
      role: UserRole.HRD_ADMIN,
      isActive: true,
      mustChangePassword: false,
      employee: null,
    });
  });

  beforeAll(async () => {
    process.env.JWT_SECRET_MONITORING = 'admin-auth-e2e-secret';
    app = await NestFactory.create(AuthApiTestModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) await app.close();
    delete process.env.JWT_SECRET_MONITORING;
  });

  it('authenticates HRD and sets the service-specific HttpOnly refresh cookie', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'valid-password' }),
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ accessToken: 'e2e-access-token' });
    expect(body).not.toHaveProperty('refreshToken');
    expect(cookie).toContain('wfh_monitoring_refresh=e2e-refresh-token');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(authService.login).toHaveBeenCalledWith(
      'admin@example.test',
      'valid-password',
      expect.any(String),
    );
  });

  it('rotates refresh cookies and logs out using the refresh cookie', async () => {
    const refreshed = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { cookie: 'wfh_monitoring_refresh=old-refresh-token' },
    });
    const loggedOut = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: 'wfh_monitoring_refresh=rotated-refresh-token' },
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.get('set-cookie')).toContain(
      'wfh_monitoring_refresh=rotated-refresh-token',
    );
    expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(loggedOut.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith('rotated-refresh-token');
    expect(loggedOut.headers.get('set-cookie')?.toLowerCase()).toContain('expires=');
  });

  it('restricts current-user and password operations to authenticated HRD admins', async () => {
    const authorization = `Bearer ${'e2e-access-token'}`;
    const currentUser = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { authorization },
    });
    const passwordChange = await fetch(`${baseUrl}/api/v1/auth/me/password`, {
      method: 'PATCH',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password-123' }),
    });

    expect(currentUser.status).toBe(200);
    expect(await currentUser.json()).toMatchObject({
      id: 'admin-id',
      role: UserRole.HRD_ADMIN,
      employee: null,
    });
    expect(passwordChange.status).toBe(204);
    expect(authService.changePassword).toHaveBeenCalledWith(
      'admin-id',
      'old-password',
      'new-password-123',
    );
  });
});
