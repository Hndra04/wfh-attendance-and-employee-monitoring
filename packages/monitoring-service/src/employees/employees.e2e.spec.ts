import 'reflect-metadata';

import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../auth/auth.guard';
import { User, UserRole } from '../database/entities/user.entity';
import { ChangeEmployeeEmailDto } from './dto/change-employee-email.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { InternalEmployeeQueryDto } from './dto/internal-employee-query.dto';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { InternalEmployeesController } from './internal-employees.controller';
import { InternalServiceGuard } from './internal-service.guard';

const employeesService = {
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  changeEmail: vi.fn(),
  changeStatus: vi.fn(),
  remove: vi.fn(),
  resetPassword: vi.fn(),
  getInternalById: vi.fn(),
  getActiveIds: vi.fn(),
};
const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'admin-id', role: UserRole.HRD_ADMIN }) };
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

Reflect.defineMetadata('design:paramtypes', [EmployeesService], EmployeesController);
Reflect.defineMetadata('design:paramtypes', [EmployeesService], InternalEmployeesController);
Reflect.defineMetadata('design:paramtypes', [JwtService, Object], AuthGuard);
Reflect.defineMetadata('design:paramtypes', [EmployeeQueryDto], EmployeesController.prototype, 'list');
Reflect.defineMetadata(
  'design:paramtypes',
  [String, ChangeEmployeeEmailDto],
  EmployeesController.prototype,
  'changeEmail',
);
Reflect.defineMetadata(
  'design:paramtypes',
  [InternalEmployeeQueryDto],
  InternalEmployeesController.prototype,
  'getActiveIds',
);

@Module({
  controllers: [EmployeesController, InternalEmployeesController],
  providers: [
    { provide: EmployeesService, useValue: employeesService },
    AuthGuard,
    { provide: JwtService, useValue: jwtService },
    { provide: getRepositoryToken(User), useValue: usersRepository },
    InternalServiceGuard,
  ],
})
class EmployeeApiTestModule {}

describe('employee API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'employee-api-test-token';
    process.env.JWT_SECRET_MONITORING = 'employee-api-test-secret';
    app = await NestFactory.create(EmployeeApiTestModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    employeesService.list.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    employeesService.getActiveIds.mockResolvedValue({ data: ['employee-id'] });
  });

  afterAll(async () => {
    if (app) await app.close();
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.JWT_SECRET_MONITORING;
  });

  it('serves validated, paginated employee-list requests', async () => {
    const response = await fetch(`${baseUrl}/api/v1/employees?page=1&limit=10`, {
      headers: { authorization: 'Bearer test-access-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [],
      meta: { page: 1, limit: 10, total: 0 },
    });
    expect(employeesService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it('requires an authenticated HRD admin for employee-management routes', async () => {
    const response = await fetch(`${baseUrl}/api/v1/employees`);

    expect(response.status).toBe(401);
    expect(employeesService.list).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination input', async () => {
    const response = await fetch(`${baseUrl}/api/v1/employees?limit=101`, {
      headers: { authorization: 'Bearer test-access-token' },
    });

    expect(response.status).toBe(400);
    expect(employeesService.list).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before changing a login email', async () => {
    const response = await fetch(`${baseUrl}/api/v1/employees/employee-id/email`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer test-access-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'new@example.test', confirm: false }),
    });

    expect(response.status).toBe(400);
    expect(employeesService.changeEmail).not.toHaveBeenCalled();
  });

  it('protects internal employee lookups with the service token', async () => {
    const denied = await fetch(`${baseUrl}/api/v1/internal/employees/ids`);
    const allowed = await fetch(`${baseUrl}/api/v1/internal/employees/ids?department=Operations`, {
      headers: { 'x-internal-service-token': 'employee-api-test-token' },
    });

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ data: ['employee-id'] });
    expect(employeesService.getActiveIds).toHaveBeenCalledWith('Operations');
  });
});
