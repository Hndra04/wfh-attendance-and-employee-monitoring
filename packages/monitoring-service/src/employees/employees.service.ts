import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';

import { Employee, EmployeeStatus } from '../database/entities/employee.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { ChangeEmployeeEmailDto } from './dto/change-employee-email.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const BCRYPT_COST = 12;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
  ) {}

  async list(query: EmployeeQueryDto) {
    const builder = this.employees.createQueryBuilder('employee');

    if (query.search?.trim()) {
      builder.andWhere(
        '(LOWER(employee.fullName) LIKE LOWER(:search) OR LOWER(employee.email) LIKE LOWER(:search))',
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.department) {
      builder.andWhere('employee.department = :department', { department: query.department });
    }
    if (query.status) {
      builder.andWhere('employee.status = :status', { status: query.status });
    }

    const [employees, total] = await builder
      .orderBy('employee.fullName', query.sort === 'desc' ? 'DESC' : 'ASC')
      .addOrderBy('employee.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      data: employees.map((employee) => this.toResponse(employee)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(id: string) {
    const employee = await this.employees.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Employee was not found.');
    }

    return { data: this.toResponse(employee) };
  }

  async create(input: CreateEmployeeDto) {
    const email = input.email.trim().toLowerCase();
    const temporaryPassword = randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    try {
      const employee = await this.dataSource.transaction(async (manager) => {
        const employeeRepository = manager.getRepository(Employee);
        const userRepository = manager.getRepository(User);
        const createdEmployee = employeeRepository.create({
          id: ulid(),
          fullName: this.requiredText(input.fullName, 'fullName'),
          email,
          department: this.requiredText(input.department, 'department'),
          position: this.requiredText(input.position, 'position'),
          joinDate: input.joinDate,
          phone: this.optionalText(input.phone),
          address: this.optionalText(input.address),
          status: input.status ?? EmployeeStatus.ACTIVE,
        });
        await employeeRepository.save(createdEmployee);
        await userRepository.save(
          userRepository.create({
            id: ulid(),
            employee: createdEmployee,
            email,
            passwordHash,
            role: UserRole.EMPLOYEE,
            isActive: createdEmployee.status === EmployeeStatus.ACTIVE,
            mustChangePassword: true,
            lastLoginAt: null,
          }),
        );

        return createdEmployee;
      });

      return { data: this.toResponse(employee), temporaryPassword };
    } catch (error) {
      this.throwForDuplicateEmail(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateEmployeeDto) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one employee field must be provided.');
    }

    return this.dataSource.transaction(async (manager) => {
      const employeeRepository = manager.getRepository(Employee);
      const userRepository = manager.getRepository(User);
      const employee = await this.findEmployee(employeeRepository, id);
      const user = await this.findUser(userRepository, employee.id);

      if (input.fullName !== undefined) {
        employee.fullName = this.requiredText(input.fullName, 'fullName');
      }
      if (input.department !== undefined) {
        employee.department = this.requiredText(input.department, 'department');
      }
      if (input.position !== undefined) {
        employee.position = this.requiredText(input.position, 'position');
      }
      if (input.joinDate !== undefined) employee.joinDate = input.joinDate;
      if (input.phone !== undefined) employee.phone = this.optionalText(input.phone);
      if (input.address !== undefined) employee.address = this.optionalText(input.address);
      if (input.status !== undefined) {
        employee.status = input.status;
        user.isActive = input.status === EmployeeStatus.ACTIVE;
        if (!user.isActive) {
          await manager.getRepository(RefreshToken).update(
            { userId: user.id, revokedAt: IsNull() },
            { revokedAt: new Date() },
          );
        }
      }

      await employeeRepository.save(employee);
      await userRepository.save(user);
      return { data: this.toResponse(employee) };
    });
  }

  async changeEmail(id: string, input: ChangeEmployeeEmailDto) {
    if (input.confirm !== true) {
      throw new BadRequestException('Email change confirmation is required.');
    }

    const email = input.email.trim().toLowerCase();
    try {
      const employee = await this.dataSource.transaction(async (manager) => {
        const employeeRepository = manager.getRepository(Employee);
        const userRepository = manager.getRepository(User);
        const currentEmployee = await this.findEmployee(employeeRepository, id);
        const user = await this.findUser(userRepository, currentEmployee.id);

        currentEmployee.email = email;
        user.email = email;
        await employeeRepository.save(currentEmployee);
        await userRepository.save(user);
        return currentEmployee;
      });

      return { data: this.toResponse(employee) };
    } catch (error) {
      this.throwForDuplicateEmail(error);
      throw error;
    }
  }

  async changeStatus(id: string, status: EmployeeStatus) {
    return this.update(id, { status });
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const employeeRepository = manager.getRepository(Employee);
      const userRepository = manager.getRepository(User);
      const refreshTokenRepository = manager.getRepository(RefreshToken);
      const employee = await this.findEmployee(employeeRepository, id);
      const user = await this.findUser(userRepository, employee.id);

      user.isActive = false;
      await userRepository.save(user);
      await refreshTokenRepository.update(
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await userRepository.softDelete({ id: user.id });
      await employeeRepository.softDelete({ id: employee.id });
    });
  }

  async resetPassword(id: string) {
    const temporaryPassword = randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

    await this.dataSource.transaction(async (manager) => {
      const employeeRepository = manager.getRepository(Employee);
      const userRepository = manager.getRepository(User);
      const refreshTokenRepository = manager.getRepository(RefreshToken);
      const employee = await this.findEmployee(employeeRepository, id);
      const user = await this.findUser(userRepository, employee.id);

      user.passwordHash = passwordHash;
      user.mustChangePassword = true;
      await userRepository.save(user);
      await refreshTokenRepository.update(
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });

    return { data: { temporaryPassword } };
  }

  async getInternalById(id: string) {
    const employee = await this.employees.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Employee was not found.');
    }

    return {
      data: {
        id: employee.id,
        fullName: employee.fullName,
        department: employee.department,
        position: employee.position,
        status: employee.status,
      },
    };
  }

  async getActiveIds(department?: string) {
    const employees = await this.employees.find({
      select: { id: true },
      where: {
        status: EmployeeStatus.ACTIVE,
        ...(department ? { department } : {}),
      },
      order: { id: 'ASC' },
    });

    return { data: employees.map(({ id }) => id) };
  }

  private async findEmployee(repository: Repository<Employee>, id: string) {
    const employee = await repository.findOne({ where: { id } });
    if (!employee) {
      throw new NotFoundException('Employee was not found.');
    }
    return employee;
  }

  private async findUser(repository: Repository<User>, employeeId: string) {
    const user = await repository.findOne({ where: { employee: { id: employeeId } } });
    if (!user || user.role !== UserRole.EMPLOYEE) {
      throw new Error(`Employee ${employeeId} has no linked employee account.`);
    }
    return user;
  }

  private requiredText(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${field} must not be empty.`);
    }
    return normalized;
  }

  private optionalText(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }

  private toResponse(employee: Employee) {
    return {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      joinDate: employee.joinDate,
      phone: employee.phone,
      address: employee.address,
      status: employee.status,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  private throwForDuplicateEmail(error: unknown): void {
    const driverError = error instanceof QueryFailedError ? error.driverError : null;
    if (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === 'ER_DUP_ENTRY'
    ) {
      throw new ConflictException({
        message: 'Email is already assigned to an active account.',
        details: [{ field: 'email', message: 'Email is already in use.' }],
      });
    }
  }
}
