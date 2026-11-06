import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('employees')
@Index('uq_employees_active_email', ['activeEmail'], { unique: true })
@Index('idx_employees_department_status', ['department', 'status'])
@Index('idx_employees_full_name', ['fullName'])
export class Employee {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName!: string;

  @Column({ type: 'varchar', length: 150 })
  email!: string;

  @Column({
    name: 'active_email',
    type: 'varchar',
    length: 150,
    nullable: true,
    asExpression: 'CASE WHEN deleted_at IS NULL THEN email ELSE NULL END',
    generatedType: 'STORED',
    insert: false,
    update: false,
    select: false,
  })
  activeEmail!: string | null;

  @Column({ type: 'varchar', length: 100 })
  department!: string;

  @Column({ type: 'varchar', length: 100 })
  position!: string;

  @Column({ name: 'join_date', type: 'date' })
  joinDate!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status!: EmployeeStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;
}
