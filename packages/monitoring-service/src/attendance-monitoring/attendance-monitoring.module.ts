import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EmployeesModule } from '../employees/employees.module';
import { AttendanceMonitoringController } from './attendance-monitoring.controller';
import { AttendanceMonitoringService } from './attendance-monitoring.service';

@Module({
  imports: [AuthModule, EmployeesModule],
  controllers: [AttendanceMonitoringController],
  providers: [AttendanceMonitoringService],
})
export class AttendanceMonitoringModule {}
