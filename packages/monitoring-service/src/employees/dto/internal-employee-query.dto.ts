import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InternalEmployeeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}
