import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { EmployeeStatus } from '../../database/entities/employee.entity';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  fullName!: string;

  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  department!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  position!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  joinDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(65535)
  address?: string | null;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
