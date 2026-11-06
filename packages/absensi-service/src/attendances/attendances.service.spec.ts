import { ConflictException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AuthenticatedUser } from '../auth/auth.types';
import { Attendance, AttendanceStatus } from '../database/entities/attendance.entity';
import { UserRole } from '../database/entities/user.entity';
import { AttendancePhotoStore } from './attendance-photo.store';
import { AttendancesService } from './attendances.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

describe('AttendancesService', () => {
  let service: AttendancesService;
  let attendances: {
    create: Mock;
    save: Mock;
    findOne: Mock;
    createQueryBuilder: Mock;
    manager: { transaction: Mock };
  };
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
    photos = {
      store: vi.fn().mockResolvedValue({ fileName: '01J00000000000000000000001.jpg', mimeType: 'image/jpeg' }),
      remove: vi.fn(),
      open: vi.fn(),
    };
    service = new AttendancesService(
      attendances as unknown as Repository<Attendance>,
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
