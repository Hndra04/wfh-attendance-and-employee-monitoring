import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestException } from '@nestjs/common';

import { Employee } from '../database/entities/employee.entity';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceMonitoringService } from './attendance-monitoring.service';
import { AttendanceMonitoringQueryDto } from './dto/attendance-monitoring-query.dto';

describe('AttendanceMonitoringService', () => {
  let service: AttendanceMonitoringService;
  let employees: Pick<EmployeesService, 'getActiveIds' | 'getAttendanceProfiles'>;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    process.env.ABSENSI_SERVICE_URL = 'http://absensi.test/api/v1';
    employees = {
      getActiveIds: vi.fn(),
      getAttendanceProfiles: vi.fn().mockResolvedValue([]),
    };
    service = new AttendanceMonitoringService(employees as EmployeesService);
  });

  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.ABSENSI_SERVICE_URL;
    vi.unstubAllGlobals();
  });

  it('returns an empty result without calling Absensi for an empty department', async () => {
    vi.mocked(employees.getActiveIds).mockResolvedValue({ data: [] });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(
      service.list(Object.assign(new AttendanceMonitoringQueryDto(), { department: 'No team' })),
    ).resolves.toMatchObject({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('proxies department filters with the service token and replaces file names with private URLs', async () => {
    vi.mocked(employees.getActiveIds).mockResolvedValue({
      data: ['01J00000000000000000000001'],
    });
    vi.mocked(employees.getAttendanceProfiles).mockResolvedValue([
      { id: '01J00000000000000000000001', fullName: 'A User' } as Employee,
    ]);
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          {
            id: 'attendance-1',
            employeeId: '01J00000000000000000000001',
            checkInPhotoFileName: 'private.jpg',
            checkOutPhotoFileName: null,
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    );
    vi.stubGlobal('fetch', fetch);

    const result = await service.list(
      Object.assign(new AttendanceMonitoringQueryDto(), { department: 'Engineering' }),
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/internal/attendances?'),
      expect.objectContaining({
        headers: { 'x-internal-service-token': 'test-internal-token' },
      }),
    );
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('employeeIds')).toBe('01J00000000000000000000001');
    expect(result.data[0]).toEqual({
      id: 'attendance-1',
      employeeId: '01J00000000000000000000001',
      checkInPhotoUrl: '/api/v1/attendances/attendance-1/photos/check-in',
      checkOutPhotoUrl: null,
      employee: { id: '01J00000000000000000000001', fullName: 'A User' },
    });
    expect(JSON.stringify(result)).not.toContain('private.jpg');
  });

  it('assembles the dashboard from today summary and seven-day series', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: { totalActiveEmployees: 4, checkedIn: 2 } }))
      .mockResolvedValueOnce(Response.json({ data: [{ date: '2026-11-01', total: 2 }] }));
    vi.stubGlobal('fetch', fetch);

    await expect(service.getDashboardSummary()).resolves.toEqual({
      data: {
        totalActiveEmployees: 4,
        checkedIn: 2,
        series: [{ date: '2026-11-01', total: 2 }],
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns a client error for an invalid attendance filter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({}, { status: 400 })),
    );

    await expect(service.list(new AttendanceMonitoringQueryDto())).rejects.toThrow(
      BadRequestException,
    );
  });
});
