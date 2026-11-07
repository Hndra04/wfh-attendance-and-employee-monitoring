import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { AuthGuard } from '../auth/auth.guard';
import { AttendanceMonitoringQueryDto } from './dto/attendance-monitoring-query.dto';
import { AttendanceMonitoringService } from './attendance-monitoring.service';

@ApiTags('Attendance monitoring')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class AttendanceMonitoringController {
  constructor(private readonly attendanceService: AttendanceMonitoringService) {}

  @Get('attendances')
  @ApiOperation({ summary: 'List and filter attendance records' })
  list(@Query() query: AttendanceMonitoringQueryDto) {
    return this.attendanceService.list(query);
  }

  @Get('attendances/:id/photos/:kind')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Stream an attendance photo without exposing storage details' })
  async getPhoto(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const photo = await this.attendanceService.getPhoto(id, kind);
    response.type(photo.contentType);
    return new StreamableFile(photo.stream);
  }

  @Get('attendances/:id')
  @ApiOperation({ summary: 'Get one attendance record' })
  getById(@Param('id') id: string) {
    return this.attendanceService.getById(id);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get attendance counters and the seven-day series' })
  getDashboardSummary() {
    return this.attendanceService.getDashboardSummary();
  }
}
