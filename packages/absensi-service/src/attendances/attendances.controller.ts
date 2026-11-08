import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import { AuthRequestUser } from '../auth/auth.types';
import { AttendancesService } from './attendances.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckInDto } from './dto/check-in.dto';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_UPLOAD_OPTIONS = {
  limits: {
    fileSize: MAX_PHOTO_BYTES,
    files: 1,
  },
};

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Post('check-in')
  @UseInterceptors(FileInterceptor('photo', PHOTO_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary' },
        notes: { type: 'string', maxLength: 500 },
      },
      required: ['photo'],
    },
  })
  @ApiOperation({ summary: 'Check in with a photo' })
  @ApiResponse({ status: 201, description: 'Attendance check-in recorded.' })
  @ApiResponse({ status: 409, description: 'Attendance was already recorded today.' })
  async checkIn(
    @Req() request: AuthRequestUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() body: CheckInDto,
  ) {
    return this.attendancesService.checkIn(request.user, photo, body);
  }

  @Post('check-out')
  @UseInterceptors(FileInterceptor('photo', PHOTO_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
      required: ['photo'],
    },
  })
  @ApiOperation({ summary: 'Check out with a photo' })
  @ApiResponse({ status: 200, description: 'Attendance check-out recorded.' })
  @ApiResponse({ status: 409, description: 'Check-in is required or check-out already exists.' })
  async checkOut(
    @Req() request: AuthRequestUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
  ) {
    return this.attendancesService.checkOut(request.user, photo);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get the current employee attendance for today' })
  getToday(@Req() request: AuthRequestUser) {
    return this.attendancesService.getToday(request.user);
  }

  @Get('me')
  @ApiOperation({ summary: 'List the current employee attendance history' })
  listMine(@Req() request: AuthRequestUser, @Query() query: AttendanceQueryDto) {
    return this.attendancesService.listMine(request.user, query);
  }

  @Get('me/:attendanceId')
  @ApiOperation({ summary: 'Get one attendance record owned by the current employee' })
  getMineById(
    @Req() request: AuthRequestUser,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.attendancesService.getMineById(request.user, attendanceId);
  }

  @Get('me/:attendanceId/photos/:kind')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Stream an attendance photo owned by the current employee' })
  async getMinePhoto(
    @Req() request: AuthRequestUser,
    @Param('attendanceId') attendanceId: string,
    @Param('kind') kind: string,
  ): Promise<StreamableFile> {
    const photo = await this.attendancesService.getMinePhoto(
      request.user,
      attendanceId,
      kind,
    );
    return new StreamableFile(photo.stream, {
      type: photo.mimeType,
      disposition: 'inline',
    });
  }
}
