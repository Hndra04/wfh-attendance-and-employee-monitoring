import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ulid } from 'ulid';

import { AuthenticatedUser } from '../auth/auth.types';
import { Attendance, AttendanceStatus } from '../database/entities/attendance.entity';
import { Employee } from '../database/entities/employee.entity';
import { AttendancePhotoStore } from './attendance-photo.store';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckInDto } from './dto/check-in.dto';
import {
  assertDateRange,
  getDurationMinutes,
  getJakartaDate,
  isLateCheckIn,
  parseWorkStartTime,
} from './attendance.utils';

interface AttendanceListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class AttendancesService {
  private readonly workStartTime = process.env.WORK_START_TIME ?? '09:00';

  constructor(
    @InjectRepository(Attendance)
    private readonly attendances: Repository<Attendance>,
    private readonly photos: AttendancePhotoStore,
  ) {
    parseWorkStartTime(this.workStartTime);
  }

  async checkIn(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    body: CheckInDto,
  ) {
    const employeeId = this.getEligibleEmployeeId(user);
    this.assertPhotoProvided(file);

    const checkedInAt = new Date();
    const photo = await this.photos.store(file);
    const attendance = this.attendances.create({
      id: ulid(),
      employee: this.createEmployeeReference(employeeId),
      attendanceDate: getJakartaDate(checkedInAt),
      checkInAt: checkedInAt,
      checkOutAt: null,
      checkInPhotoPath: photo.fileName,
      checkOutPhotoPath: null,
      notes: body.notes?.trim() || null,
      status: isLateCheckIn(checkedInAt, this.workStartTime)
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT,
    });

    try {
      return this.toAttendanceResponse(await this.attendances.save(attendance));
    } catch (error) {
      return this.removePhotoAfterFailure(photo.fileName, error);
    }
  }

  async checkOut(user: AuthenticatedUser, file: Express.Multer.File | undefined) {
    const employeeId = this.getEligibleEmployeeId(user);
    this.assertPhotoProvided(file);

    const checkedOutAt = new Date();
    const photo = await this.photos.store(file);

    try {
      const attendance = await this.attendances.manager.transaction(async (manager) => {
        const attendanceRepository = manager.getRepository(Attendance);
        const record = await attendanceRepository
          .createQueryBuilder('attendance')
          .setLock('pessimistic_write')
          .where('attendance.employee = :employeeId', { employeeId })
          .andWhere('attendance.attendanceDate = :attendanceDate', {
            attendanceDate: getJakartaDate(checkedOutAt),
          })
          .getOne();

        if (!record) {
          throw new ConflictException('Check-in is required before checking out.');
        }
        if (record.checkOutAt) {
          throw new ConflictException('You have already checked out today.');
        }

        record.checkOutAt = checkedOutAt;
        record.checkOutPhotoPath = photo.fileName;
        return attendanceRepository.save(record);
      });

      return this.toAttendanceResponse(attendance);
    } catch (error) {
      return this.removePhotoAfterFailure(photo.fileName, error);
    }
  }

  async getToday(user: AuthenticatedUser) {
    const employeeId = this.getEligibleEmployeeId(user);
    const attendance = await this.attendances.findOne({
      where: {
        employee: { id: employeeId },
        attendanceDate: getJakartaDate(new Date()),
      },
    });

    return { data: attendance ? this.toAttendanceResponse(attendance) : null };
  }

  async listMine(user: AuthenticatedUser, query: AttendanceQueryDto) {
    const employeeId = this.getEligibleEmployeeId(user);
    assertDateRange(query.from, query.to);

    const queryBuilder = this.attendances
      .createQueryBuilder('attendance')
      .where('attendance.employee = :employeeId', { employeeId });

    if (query.from) {
      queryBuilder.andWhere('attendance.attendanceDate >= :from', { from: query.from });
    }
    if (query.to) {
      queryBuilder.andWhere('attendance.attendanceDate <= :to', { to: query.to });
    }

    const [records, total] = await queryBuilder
      .orderBy('attendance.attendanceDate', this.getSortDirection(query.sort))
      .addOrderBy('attendance.checkInAt', this.getSortDirection(query.sort))
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const meta: AttendanceListMeta = {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };

    return { data: records.map((record) => this.toAttendanceResponse(record)), meta };
  }

  async getMineById(user: AuthenticatedUser, attendanceId: string) {
    const employeeId = this.getEligibleEmployeeId(user);
    const attendance = await this.attendances.findOne({
      where: { id: attendanceId, employee: { id: employeeId } },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record was not found.');
    }

    return { data: this.toAttendanceResponse(attendance) };
  }

  async getMinePhoto(
    user: AuthenticatedUser,
    attendanceId: string,
    kind: string,
  ) {
    const employeeId = this.getEligibleEmployeeId(user);
    const attendance = await this.attendances.findOne({
      where: { id: attendanceId },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record was not found.');
    }
    if (attendance.employeeId !== employeeId) {
      throw new ForbiddenException('You can only access your own attendance photos.');
    }

    const photoPath =
      kind === 'check-in'
        ? attendance.checkInPhotoPath
        : kind === 'check-out'
          ? attendance.checkOutPhotoPath
          : null;

    if (!photoPath) {
      throw new NotFoundException('Attendance photo was not found.');
    }

    return this.photos.open(photoPath);
  }

  private getEligibleEmployeeId(user: AuthenticatedUser): string {
    if (user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('An active employee account is required.');
    }
    if (user.mustChangePassword) {
      throw new ForbiddenException('Change your password before using attendance features.');
    }
    if (!user.employee) {
      throw new ForbiddenException('The account is not linked to an employee profile.');
    }

    return user.employee.id;
  }

  private assertPhotoProvided(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
    if (!file) {
      throw new UnprocessableEntityException('A check-in or check-out photo is required.');
    }
  }

  private createEmployeeReference(employeeId: string): Employee {
    const employee = new Employee();
    employee.id = employeeId;
    return employee;
  }

  private getSortDirection(sort: AttendanceQueryDto['sort']): 'ASC' | 'DESC' {
    return sort === 'asc' ? 'ASC' : 'DESC';
  }

  private toAttendanceResponse(attendance: Attendance) {
    const basePath = `/api/v1/attendances/me/${attendance.id}/photos`;
    return {
      id: attendance.id,
      employeeId: attendance.employeeId,
      attendanceDate: attendance.attendanceDate,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      checkInPhotoUrl: `${basePath}/check-in`,
      checkOutPhotoUrl: attendance.checkOutPhotoPath ? `${basePath}/check-out` : null,
      notes: attendance.notes,
      status: attendance.status,
      durationMinutes: getDurationMinutes(attendance.checkInAt, attendance.checkOutAt),
    };
  }

  private async removePhotoAfterFailure(fileName: string, originalError: unknown): Promise<never> {
    try {
      await this.photos.remove(fileName);
    } catch (cleanupError) {
      throw new AggregateError(
        [originalError, cleanupError],
        'Attendance could not be saved and its uploaded photo could not be removed.',
      );
    }

    if (this.isDuplicateAttendanceError(originalError)) {
      throw new ConflictException('Attendance has already been recorded for today.');
    }

    throw originalError;
  }

  private isDuplicateAttendanceError(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === 'ER_DUP_ENTRY'
    );
  }
}
