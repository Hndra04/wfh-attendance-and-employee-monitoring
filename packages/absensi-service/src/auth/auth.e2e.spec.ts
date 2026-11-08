import 'reflect-metadata';

import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../database/entities/user.entity';

const authService = {
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
};
const jwtService = {
  verifyAsync: vi.fn().mockResolvedValue({ sub: 'employee-id', role: UserRole.EMPLOYEE }),
};
const usersRepository = {
  findOne: vi.fn().mockResolvedValue({
    id: 'employee-id',
    email: 'employee@example.test',
    role: UserRole.EMPLOYEE,
    isActive: true,
    mustChangePassword: false,
    employee: {
      id: 'employee-id',
      fullName: 'Test Employee',
      department: 'Operations',
      position: 'Staff',
    },
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

describe('employee auth API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
    authService.login.mockResolvedValue({
      accessToken: 'e2e-access-token',
      refreshToken: 'e2e-refresh-token',
      user: { id: 'employee-id', role: UserRole.EMPLOYEE },
    });
    authService.refresh.mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      user: { id: 'employee-id', role: UserRole.EMPLOYEE },
    });
    authService.logout.mockResolvedValue(undefined);
    authService.changePassword.mockResolvedValue(undefined);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'employee-id',
      role: UserRole.EMPLOYEE,
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'employee-id',
      email: 'employee@example.test',
      role: UserRole.EMPLOYEE,
      isActive: true,
      mustChangePassword: false,
      employee: {
        id: 'employee-id',
        fullName: 'Test Employee',
        department: 'Operations',
        position: 'Staff',
      },
    });
  });

  beforeAll(async () => {
    process.env.JWT_SECRET_ABSENSI = 'employee-auth-e2e-secret';
    app = await NestFactory.create(AuthApiTestModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) await app.close();
    delete process.env.JWT_SECRET_ABSENSI;
  });

  it('authenticates an employee and keeps the refresh token in an HttpOnly cookie', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'employee@example.test', password: 'valid-password' }),
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ accessToken: 'e2e-access-token' });
    expect(body).not.toHaveProperty('refreshToken');
    expect(cookie).toContain('wfh_absensi_refresh=e2e-refresh-token');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(authService.login).toHaveBeenCalledWith(
      'employee@example.test',
      'valid-password',
      expect.any(String),
    );
  });

  it('rotates refresh cookies and revokes the presented token on logout', async () => {
    const refreshed = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { cookie: 'wfh_absensi_refresh=old-refresh-token' },
    });
    const loggedOut = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: 'wfh_absensi_refresh=rotated-refresh-token' },
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.headers.get('set-cookie')).toContain(
      'wfh_absensi_refresh=rotated-refresh-token',
    );
    expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(loggedOut.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith('rotated-refresh-token');
    expect(loggedOut.headers.get('set-cookie')?.toLowerCase()).toContain('expires=');
  });

  it('protects the current-user and password routes with the employee bearer token', async () => {
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
      id: 'employee-id',
      role: UserRole.EMPLOYEE,
      employee: { fullName: 'Test Employee' },
    });
    expect(passwordChange.status).toBe(204);
    expect(authService.changePassword).toHaveBeenCalledWith(
      'employee-id',
      'old-password',
      'new-password-123',
    );
  });
});
