import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InternalAttendanceQueryDto } from './dto/internal-attendance-query.dto';
import { InternalAttendanceSeriesDto } from './dto/internal-attendance-series.dto';
import { InternalAttendanceSummaryDto } from './dto/internal-attendance-summary.dto';
import { AttendancesService } from './attendances.service';
import { InternalServiceGuard } from './internal-service.guard';

@ApiTags('Internal Attendances')
@ApiHeader({ name: 'x-internal-service-token', required: true })
@UseGuards(InternalServiceGuard)
@Controller('internal/attendances')
export class InternalAttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Get()
  @ApiOperation({ summary: 'List attendance records for an internal HRD proxy' })
  list(@Query() query: InternalAttendanceQueryDto) {
    return this.attendancesService.listInternal(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get active employee attendance counts for a Jakarta date' })
  summary(@Query() query: InternalAttendanceSummaryDto) {
    return this.attendancesService.getInternalSummary(query.date);
  }

  @Get('series')
  @ApiOperation({ summary: 'Get daily attendance totals for a date range' })
  series(@Query() query: InternalAttendanceSeriesDto) {
    return this.attendancesService.getInternalSeries(query.from, query.to);
  }

  @Get(':id/photos/:kind')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Stream an attendance photo to an internal service' })
  async getPhoto(
    @Param('id') id: string,
    @Param('kind') kind: string,
  ): Promise<StreamableFile> {
    const photo = await this.attendancesService.getInternalPhoto(id, kind);
    return new StreamableFile(photo.stream, {
      type: photo.mimeType,
      disposition: 'inline',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one attendance record for an internal HRD proxy' })
  getById(@Param('id') id: string) {
    return this.attendancesService.getInternalById(id);
  }
}
