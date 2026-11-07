import { IsEnum } from 'class-validator';

import { EmployeeStatus } from '../../database/entities/employee.entity';

export class UpdateEmployeeStatusDto {
  @IsEnum(EmployeeStatus)
  status!: EmployeeStatus;
}
