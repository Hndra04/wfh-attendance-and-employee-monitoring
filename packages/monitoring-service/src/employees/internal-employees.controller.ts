import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InternalEmployeeQueryDto } from './dto/internal-employee-query.dto';
import { EmployeesService } from './employees.service';
import { InternalServiceGuard } from './internal-service.guard';

@ApiTags('Internal Employees')
@ApiHeader({ name: 'x-internal-service-token', required: true })
@UseGuards(InternalServiceGuard)
@Controller('internal/employees')
export class InternalEmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('ids')
  @ApiOperation({ summary: 'Resolve active employee IDs, optionally by department' })
  getActiveIds(@Query() query: InternalEmployeeQueryDto) {
    return this.employeesService.getActiveIds(query.department);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Look up an employee profile for an internal service' })
  getById(@Param('id') id: string) {
    return this.employeesService.getInternalById(id);
  }
}
