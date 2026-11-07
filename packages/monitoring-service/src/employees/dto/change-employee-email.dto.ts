import { Equals, IsEmail, MaxLength } from 'class-validator';

export class ChangeEmployeeEmailDto {
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @Equals(true)
  confirm!: boolean;
}
