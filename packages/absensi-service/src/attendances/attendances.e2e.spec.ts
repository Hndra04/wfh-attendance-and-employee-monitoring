import 'reflect-metadata';

import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../auth/auth.guard';
import { User, UserRole } from '../database/entities/user.entity';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckInDto } from './dto/check-in.dto';

const attendancesService = {
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  getToday: vi.fn(),
  listMine: vi.fn(),
  getMineById: vi.fn(),
  getMinePhoto: vi.fn(),
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

Reflect.defineMetadata('design:paramtypes', [AttendancesService], AttendancesController);
Reflect.defineMetadata(
  'design:paramtypes',
  [Object, Object, CheckInDto],
  AttendancesController.prototype,
  'checkIn',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [Object, Object],
  AttendancesController.prototype,
  'checkOut',
);
Reflect.defineMetadata('design:paramtypes', [Object], AttendancesController.prototype, 'getToday');
Reflect.defineMetadata(
  'design:paramtypes',
  [Object, AttendanceQueryDto],
  AttendancesController.prototype,
  'listMine',
);
Reflect.defineMetadata('design:paramtypes', [Object, String], AttendancesController.prototype, 'getMineById');
Reflect.defineMetadata(
  'design:paramtypes',
  [JwtService, Object],
  AuthGuard,
);

@Module({
  controllers: [AttendancesController],
  providers: [
    { provide: AttendancesService, useValue: attendancesService },
    AuthGuard,
    { provide: JwtService, useValue: jwtService },
    { provide: getRepositoryToken(User), useValue: usersRepository },
  ],
})
class AttendanceApiTestModule {}

describe('employee attendance API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
    attendancesService.checkIn.mockResolvedValue({
      id: 'attendance-id',
      status: 'PRESENT',
      checkInAt: '2026-11-07T02:00:00.000Z',
    });
    attendancesService.checkOut.mockResolvedValue({ id: 'attendance-id' });
    attendancesService.getToday.mockResolvedValue({ data: null });
    attendancesService.listMine.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
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
    process.env.JWT_SECRET_ABSENSI = 'employee-attendance-e2e-secret';
    app = await NestFactory.create(AttendanceApiTestModule, {
      logger: false,
      abortOnError: false,
    });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) await app.close();
    delete process.env.JWT_SECRET_ABSENSI;
  });

  it('requires an authenticated employee to check in with multipart photo data', async () => {
    const denied = await fetch(`${baseUrl}/api/v1/attendances/check-in`, { method: 'POST' });
    const form = new FormData();
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    form.set('photo', jpeg, 'check-in.jpg');
    form.set('notes', 'Working from home');
    const created = await fetch(`${baseUrl}/api/v1/attendances/check-in`, {
      method: 'POST',
      headers: { authorization: `Bearer ${'e2e-access-token'}` },
      body: form,
    });

    expect(denied.status).toBe(401);
    expect(attendancesService.checkIn).not.toHaveBeenCalled();
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: 'attendance-id', status: 'PRESENT' });
    expect(attendancesService.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'employee-id', role: UserRole.EMPLOYEE }),
      expect.objectContaining({
        originalname: 'check-in.jpg',
        mimetype: 'image/jpeg',
      }),
      expect.objectContaining({ notes: 'Working from home' }),
    );
  });

  it('rejects invalid check-in notes before calling the attendance service', async () => {
    const form = new FormData();
    form.set('photo', new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }), 'check-in.jpg');
    form.set('notes', 'x'.repeat(501));
    const response = await fetch(`${baseUrl}/api/v1/attendances/check-in`, {
      method: 'POST',
      headers: { authorization: `Bearer ${'e2e-access-token'}` },
      body: form,
    });

    expect(response.status).toBe(400);
    expect(attendancesService.checkIn).not.toHaveBeenCalled();
  });

  it('serves the authenticated employee attendance history over HTTP', async () => {
    const response = await fetch(`${baseUrl}/api/v1/attendances/me?page=1&limit=10`, {
      headers: { authorization: `Bearer ${'e2e-access-token'}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [],
      meta: { page: 1, limit: 10, total: 0 },
    });
    expect(attendancesService.listMine).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'employee-id' }),
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });
});
