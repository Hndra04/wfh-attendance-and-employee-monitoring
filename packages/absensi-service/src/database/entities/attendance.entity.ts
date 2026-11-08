import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';

import { Employee } from './employee.entity';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
}

@Entity('attendances')
@Index('uq_attendances_employee_date', ['employee', 'attendanceDate'], { unique: true })
@Index('idx_attendances_date', ['attendanceDate'])
export class Attendance {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @RelationId((attendance: Attendance) => attendance.employee)
  employeeId!: string;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate!: string;

  @Column({ name: 'check_in_at', type: 'datetime', nullable: true })
  checkInAt!: Date | null;

  @Column({ name: 'check_out_at', type: 'datetime', nullable: true })
  checkOutAt!: Date | null;

  @Column({ name: 'check_in_photo_path', type: 'varchar', length: 255 })
  checkInPhotoPath!: string;

  @Column({ name: 'check_out_photo_path', type: 'varchar', length: 255, nullable: true })
  checkOutPhotoPath!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status!: AttendanceStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
