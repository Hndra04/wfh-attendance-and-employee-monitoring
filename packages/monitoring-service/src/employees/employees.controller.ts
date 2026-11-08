import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { EmployeeStatus } from '../database/entities/employee.entity';
import { ChangeEmployeeEmailDto } from './dto/change-employee-email.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter employees' })
  list(@Query() query: EmployeeQueryDto) {
    return this.employeesService.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an employee and one-time login password' })
  @ApiResponse({ status: 201, description: 'Employee and employee login created.' })
  @ApiResponse({ status: 409, description: 'Email is already in use.' })
  create(@Body() body: CreateEmployeeDto) {
    return this.employeesService.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee' })
  getById(@Param('id') id: string) {
    return this.employeesService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee profile or status' })
  update(@Param('id') id: string, @Body() body: UpdateEmployeeDto) {
    return this.employeesService.update(id, body);
  }

  @Patch(':id/email')
  @ApiOperation({ summary: 'Change employee login email after explicit confirmation' })
  @ApiResponse({ status: 409, description: 'Email is already in use.' })
  changeEmail(@Param('id') id: string, @Body() body: ChangeEmployeeEmailDto) {
    return this.employeesService.changeEmail(id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate an employee account' })
  changeStatus(@Param('id') id: string, @Body() body: UpdateEmployeeStatusDto) {
    return this.employeesService.changeStatus(id, body.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an employee and deactivate the login account' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.employeesService.remove(id);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Generate a one-time employee password' })
  resetPassword(@Param('id') id: string) {
    return this.employeesService.resetPassword(id);
  }
}
