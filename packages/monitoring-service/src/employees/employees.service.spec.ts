import * as bcrypt from 'bcryptjs';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { Employee, EmployeeStatus } from '../database/entities/employee.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let employees: { createQueryBuilder: Mock; find: Mock };
  let dataSource: { transaction: Mock };
  let employeeRepository: {
    create: Mock;
    save: Mock;
    findOne: Mock;
    softDelete: Mock;
  };
  let userRepository: {
    create: Mock;
    save: Mock;
    findOne: Mock;
    softDelete: Mock;
  };
  let refreshTokenRepository: { update: Mock };

  beforeEach(() => {
    employees = { createQueryBuilder: vi.fn(), find: vi.fn() };
    employeeRepository = {
      create: vi.fn((employee) => employee),
      save: vi.fn(async (employee) => employee),
      findOne: vi.fn(),
      softDelete: vi.fn(),
    };
    userRepository = {
      create: vi.fn((user) => user),
      save: vi.fn(async (user) => user),
      findOne: vi.fn(),
      softDelete: vi.fn(),
    };
    refreshTokenRepository = { update: vi.fn() };
    dataSource = {
      transaction: vi.fn((callback) =>
        callback({
          getRepository: (entity: unknown) =>
            entity === Employee
              ? employeeRepository
              : entity === User
                ? userRepository
                : refreshTokenRepository,
        }),
      ),
    };
    service = new EmployeesService(
      dataSource as unknown as DataSource,
      employees as unknown as Repository<Employee>,
    );
  });

  it('creates an employee and linked active login with a one-time password', async () => {
    const result = await service.create({
      fullName: '  Ayu Pratama ',
      email: ' AYU@example.test ',
      department: ' Operations ',
      position: ' Staff ',
      joinDate: '2024-01-15',
    });

    expect(result.temporaryPassword).toBeTruthy();
    expect(result.data).toMatchObject({
      fullName: 'Ayu Pratama',
      email: 'ayu@example.test',
      department: 'Operations',
      status: EmployeeStatus.ACTIVE,
    });
    const createdUser = userRepository.create.mock.calls[0][0] as User;
    expect(await bcrypt.compare(result.temporaryPassword, createdUser.passwordHash)).toBe(true);
    expect(createdUser).toMatchObject({
      email: 'ayu@example.test',
      role: UserRole.EMPLOYEE,
      isActive: true,
      mustChangePassword: true,
    });
  });

  it('updates employee status and account activation in one transaction', async () => {
    const employee = createEmployee();
    const user = createUser(employee);
    employeeRepository.findOne.mockResolvedValue(employee);
    userRepository.findOne.mockResolvedValue(user);

    await service.changeStatus(employee.id, EmployeeStatus.INACTIVE);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(employee.status).toBe(EmployeeStatus.INACTIVE);
    expect(user.isActive).toBe(false);
    expect(employeeRepository.save).toHaveBeenCalledWith(employee);
    expect(userRepository.save).toHaveBeenCalledWith(user);
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: user.id, revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });

  it('requires explicit confirmation and changes the login email atomically', async () => {
    const employee = createEmployee();
    const user = createUser(employee);
    employeeRepository.findOne.mockResolvedValue(employee);
    userRepository.findOne.mockResolvedValue(user);

    await expect(
      service.changeEmail(employee.id, { email: 'new@example.test', confirm: false }),
    ).rejects.toThrow('Email change confirmation is required.');
    expect(dataSource.transaction).not.toHaveBeenCalled();

    await service.changeEmail(employee.id, { email: ' NEW@example.test ', confirm: true });
    expect(employee.email).toBe('new@example.test');
    expect(user.email).toBe('new@example.test');
    expect(employeeRepository.save).toHaveBeenCalledWith(employee);
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('returns a field-level conflict when an email is already in use', async () => {
    dataSource.transaction.mockRejectedValue(
      new QueryFailedError('UPDATE users', [], { code: 'ER_DUP_ENTRY' }),
    );

    await expect(
      service.changeEmail('employee-id', { email: 'taken@example.test', confirm: true }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        details: [{ field: 'email', message: 'Email is already in use.' }],
      },
    });
  });

  it('soft-deletes the employee and deactivates the linked account while revoking refresh tokens', async () => {
    const employee = createEmployee();
    const user = createUser(employee);
    employeeRepository.findOne.mockResolvedValue(employee);
    userRepository.findOne.mockResolvedValue(user);

    await service.remove(employee.id);

    expect(user.isActive).toBe(false);
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: user.id, revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
    expect(userRepository.softDelete).toHaveBeenCalledWith({ id: user.id });
    expect(employeeRepository.softDelete).toHaveBeenCalledWith({ id: employee.id });
  });

  it('resets the password once and revokes existing refresh tokens', async () => {
    const employee = createEmployee();
    const user = createUser(employee);
    employeeRepository.findOne.mockResolvedValue(employee);
    userRepository.findOne.mockResolvedValue(user);

    const result = await service.resetPassword(employee.id);

    expect(await bcrypt.compare(result.data.temporaryPassword, user.passwordHash)).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { userId: user.id, revokedAt: expect.anything() },
      { revokedAt: expect.any(Date) },
    );
  });

  it('resolves only active employee IDs and applies the optional department filter', async () => {
    employees.find.mockResolvedValue([{ id: 'employee-id' }]);

    await expect(service.getActiveIds('Operations')).resolves.toEqual({
      data: ['employee-id'],
    });

    expect(employees.find).toHaveBeenCalledWith({
      select: { id: true },
      where: { status: EmployeeStatus.ACTIVE, department: 'Operations' },
      order: { id: 'ASC' },
    });
  });
});

function createEmployee(): Employee {
  return {
    id: 'employee-id',
    fullName: 'Ayu Pratama',
    email: 'ayu@example.test',
    department: 'Operations',
    position: 'Staff',
    joinDate: '2024-01-15',
    phone: null,
    address: null,
    status: EmployeeStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Employee;
}

function createUser(employee: Employee): User {
  return {
    id: 'user-id',
    employee,
    email: employee.email,
    passwordHash: 'password-hash',
    role: UserRole.EMPLOYEE,
    isActive: true,
    mustChangePassword: true,
    lastLoginAt: null,
  } as User;
}
