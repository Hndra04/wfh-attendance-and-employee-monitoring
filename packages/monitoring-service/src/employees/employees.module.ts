import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Employee } from '../database/entities/employee.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { User } from '../database/entities/user.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { InternalEmployeesController } from './internal-employees.controller';
import { InternalServiceGuard } from './internal-service.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, User, RefreshToken])],
  controllers: [EmployeesController, InternalEmployeesController],
  providers: [EmployeesService, InternalServiceGuard],
})
export class EmployeesModule {}
