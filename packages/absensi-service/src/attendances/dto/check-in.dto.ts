import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckInDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
