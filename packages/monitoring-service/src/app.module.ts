import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import dataSource from './database/data-source';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceMonitoringModule } from './attendance-monitoring/attendance-monitoring.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSource.options),
    AuthModule,
    EmployeesModule,
    AttendanceMonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
