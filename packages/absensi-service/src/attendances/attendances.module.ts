import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Attendance } from '../database/entities/attendance.entity';
import { User } from '../database/entities/user.entity';
import { AuthGuard } from '../auth/auth.guard';
import { AttendancePhotoStore } from './attendance-photo.store';
import { AttendancesController } from './attendances.controller';
import { AttendancesService } from './attendances.service';
import { InternalAttendancesController } from './internal-attendances.controller';
import { InternalServiceGuard } from './internal-service.guard';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([Attendance, User])],
  controllers: [AttendancesController, InternalAttendancesController],
  providers: [AuthGuard, InternalServiceGuard, AttendancesService, AttendancePhotoStore],
})
export class AttendancesModule {}
