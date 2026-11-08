import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AuthenticatedUser } from '../auth/auth.types';
import { Attendance, AttendanceStatus } from '../database/entities/attendance.entity';
import { User, UserRole } from '../database/entities/user.entity';
import { AttendancePhotoStore } from './attendance-photo.store';
import { AttendancesService } from './attendances.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { InternalAttendanceQueryDto } from './dto/internal-attendance-query.dto';

describe('AttendancesService', () => {
  let service: AttendancesService;
  let attendances: {
    create: Mock;
    save: Mock;
    findOne: Mock;
    createQueryBuilder: Mock;
    manager: { transaction: Mock };
  };
  let users: { count: Mock };
  let photos: { store: Mock; remove: Mock; open: Mock };

  beforeEach(() => {
    process.env.WORK_START_TIME = '09:00';
    attendances = {
      create: vi.fn((record) => record),
      save: vi.fn((record) => record),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(),
      manager: { transaction: vi.fn() },
    };
    users = { count: vi.fn() };
    photos = {
      store: vi.fn().mockResolvedValue({ fileName: '01J00000000000000000000001.jpg', mimeType: 'image/jpeg' }),
      remove: vi.fn(),
      open: vi.fn(),
    };
    service = new AttendancesService(
      attendances as unknown as Repository<Attendance>,
      users as unknown as Repository<User>,
      photos as unknown as AttendancePhotoStore,
    );
  });

  afterEach(() => {
    delete process.env.WORK_START_TIME;
    vi.useRealTimers();
  });

  it('creates one Jakarta-date attendance and computes late status from server time', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-11-06T02:01:00.000Z'));

    const result = await service.checkIn(employeeUser(), jpegUpload(), { notes: '  At home  ' });

    expect(attendances.save).toHaveBeenCalledWith(
      expect.objectContaining({
        employee: expect.objectContaining({ id: 'employee-1' }),
        attendanceDate: '2026-11-06',
        checkInAt: new Date('2026-11-06T02:01:00.000Z'),
        status: AttendanceStatus.LATE,
        notes: 'At home',
      }),
    );
    expect(result.checkInPhotoUrl).toContain('/photos/check-in');
    expect(result.durationMinutes).toBeNull();
  });

  it('removes the uploaded image and reports a conflict for a duplicate check-in', async () => {
    const duplicateError = new QueryFailedError(
      'INSERT INTO attendances',
      [],
      Object.assign(new Error('duplicate key'), { code: 'ER_DUP_ENTRY' }),
    );
    attendances.save.mockRejectedValue(duplicateError);

    await expect(
      service.checkIn(employeeUser(), jpegUpload(), {}),
    ).rejects.toThrow(ConflictException);
    expect(photos.remove).toHaveBeenCalledWith('01J00000000000000000000001.jpg');
  });

  it('requires a changed password before attendance access', async () => {
    await expect(
      service.getToday({ ...employeeUser(), mustChangePassword: true }),
    ).rejects.toThrow(ForbiddenException);
    expect(attendances.findOne).not.toHaveBeenCalled();
  });

  it('returns an empty attendance envelope when no check-in exists today', async () => {
    attendances.findOne.mockResolvedValue(null);

    await expect(service.getToday(employeeUser())).resolves.toEqual({ data: null });
    expect(attendances.findOne).toHaveBeenCalledWith({
      where: {
        employee: { id: 'employee-1' },
        attendanceDate: expect.any(String),
      },
    });
  });

  it('forbids access to another employee’s attendance photo', async () => {
    attendances.findOne.mockResolvedValue({
      id: 'attendance-2',
      employeeId: 'employee-2',
      checkInPhotoPath: '01J00000000000000000000002.jpg',
    });

    await expect(
      service.getMinePhoto(employeeUser(), 'attendance-2', 'check-in'),
    ).rejects.toThrow(ForbiddenException);
    expect(photos.open).not.toHaveBeenCalled();
  });

  it('locks today’s record and rejects check-out when there is no check-in', async () => {
    const queryBuilder = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    const repository = { createQueryBuilder: vi.fn().mockReturnValue(queryBuilder) };
    attendances.manager.transaction.mockImplementation((operation) =>
      operation({ getRepository: () => repository }),
    );

    await expect(
      service.checkOut(employeeUser(), jpegUpload()),
    ).rejects.toThrow('Check-in is required before checking out.');
    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(photos.remove).toHaveBeenCalledWith('01J00000000000000000000001.jpg');
  });

  it('returns only records belonging to the authenticated employee with pagination metadata', async () => {
    const record = {
      id: 'attendance-1',
      employeeId: 'employee-1',
      attendanceDate: '2026-11-06',
      checkInAt: new Date('2026-11-06T02:00:00Z'),
      checkOutAt: new Date('2026-11-06T10:00:00Z'),
      checkInPhotoPath: '01J00000000000000000000001.jpg',
      checkOutPhotoPath: '01J00000000000000000000002.jpg',
      notes: null,
      status: AttendanceStatus.PRESENT,
    };
    const queryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[record], 11]),
    };
    attendances.createQueryBuilder.mockReturnValue(queryBuilder);
    const query = Object.assign(new AttendanceQueryDto(), {
      page: 2,
      limit: 10,
      from: '2026-11-01',
      to: '2026-11-30',
      sort: 'desc' as const,
    });

    const result = await service.listMine(employeeUser(), query);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'attendance.employee = :employeeId',
      { employeeId: 'employee-1' },
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
    expect(result.data[0].durationMinutes).toBe(480);
  });

  it('returns an empty page without querying for an empty employee ID filter', async () => {
    const result = await service.listInternal(
      Object.assign(new InternalAttendanceQueryDto(), { employeeIds: '' }),
    );

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(attendances.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects malformed employee IDs in internal list filters', async () => {
    await expect(
      service.listInternal(
        Object.assign(new InternalAttendanceQueryDto(), { employeeIds: 'not-an-id' }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(attendances.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns paginated internal attendance fields without employee-facing photo URLs', async () => {
    const record = {
      id: 'attendance-1',
      employeeId: '01J00000000000000000000001',
      attendanceDate: '2026-11-06',
      checkInAt: new Date('2026-11-06T02:00:00Z'),
      checkOutAt: null,
      checkInPhotoPath: '01J00000000000000000000001.jpg',
      checkOutPhotoPath: null,
      notes: null,
      status: AttendanceStatus.PRESENT,
    };
    const queryBuilder = {
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[record], 1]),
    };
    attendances.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.listInternal(
      Object.assign(new InternalAttendanceQueryDto(), {
        employeeIds: '01J00000000000000000000001',
        from: '2026-11-01',
        to: '2026-11-30',
        page: 1,
        limit: 10,
      }),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'attendance.employee IN (:...employeeIds)',
      { employeeIds: ['01J00000000000000000000001'] },
    );
    expect(result.data[0]).toMatchObject({
      id: 'attendance-1',
      checkInPhotoFileName: '01J00000000000000000000001.jpg',
    });
    expect(result.meta.total).toBe(1);
  });

  it('returns internal summary counts for the requested date', async () => {
    users.count.mockResolvedValue(8);
    const queryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ checkedIn: '3', checkedOut: '2' }),
    };
    attendances.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.getInternalSummary('2026-11-06')).resolves.toEqual({
      data: {
        date: '2026-11-06',
        totalActiveEmployees: 8,
        checkedIn: 3,
        notCheckedIn: 5,
        checkedOut: 2,
      },
    });
  });

  it('fills a seven-day series with zero-count dates and rejects longer ranges', async () => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      setParameters: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { date: '2026-11-03', total: '2', present: '1', late: '1' },
      ]),
    };
    attendances.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getInternalSeries('2026-11-01', '2026-11-07');
    expect(result.data).toHaveLength(7);
    expect(result.data[0]).toEqual({
      date: '2026-11-01',
      total: 0,
      present: 0,
      late: 0,
    });
    expect(result.data[2]).toEqual({
      date: '2026-11-03',
      total: 2,
      present: 1,
      late: 1,
    });
    await expect(
      service.getInternalSeries('2026-11-01', '2026-11-08'),
    ).rejects.toThrow(BadRequestException);
    expect(attendances.createQueryBuilder).toHaveBeenCalledTimes(1);
  });
});

function employeeUser(): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'employee@example.com',
    role: UserRole.EMPLOYEE,
    mustChangePassword: false,
    employee: {
      id: 'employee-1',
      fullName: 'Test Employee',
      department: 'Engineering',
      position: 'Developer',
    },
  };
}

function jpegUpload(): Express.Multer.File {
  return {
    fieldname: 'photo',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 4,
    destination: '',
    filename: '',
    path: '',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    stream: null as unknown as Express.Multer.File['stream'],
  };
}
