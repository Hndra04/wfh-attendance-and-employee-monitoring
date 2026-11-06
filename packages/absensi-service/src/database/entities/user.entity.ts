import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Employee } from './employee.entity';

export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  HRD_ADMIN = 'HRD_ADMIN',
}

@Entity('users')
@Index('idx_users_email', ['email'])
@Index('uq_users_active_email', ['activeEmail'], { unique: true })
export class User {
  @PrimaryColumn({ type: 'char', length: 26 })
  id!: string;

  @OneToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee | null;

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

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;
}
