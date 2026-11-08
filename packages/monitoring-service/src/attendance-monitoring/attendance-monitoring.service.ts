import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Readable } from 'node:stream';

import { Employee } from '../database/entities/employee.entity';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceMonitoringQueryDto } from './dto/attendance-monitoring-query.dto';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  checkInPhotoFileName?: string;
  checkOutPhotoFileName?: string | null;
}

@Injectable()
export class AttendanceMonitoringService {
  private readonly absensiUrl = (process.env.ABSENSI_SERVICE_URL ?? 'http://localhost:3001/api/v1')
    .replace(/\/+$/, '');
  private readonly token: string;

  constructor(private readonly employeesService: EmployeesService) {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token) {
      throw new Error('INTERNAL_SERVICE_TOKEN must be configured.');
    }
    this.token = token;
  }

  async list(query: AttendanceMonitoringQueryDto) {
    const employeeIds = query.department
      ? (await this.employeesService.getActiveIds(query.department)).data
      : undefined;
    if (employeeIds && employeeIds.length === 0) {
      return {
        data: [],
        meta: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      };
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      page: query.page,
      limit: query.limit,
      employeeId: query.employeeId,
      employeeIds: employeeIds?.join(','),
      from: query.from,
      to: query.to,
      status: query.status,
      sort: query.sort,
    })) {
      if (value !== undefined) params.set(key, String(value));
    }
    const result = await this.request<{
      data: AttendanceRecord[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(`/attendances?${params}`);
    const profiles = await this.getProfiles(result.data);

    return {
      ...result,
      data: result.data.map((record) => this.toResponse(record, profiles)),
    };
  }

  async getById(id: string) {
    const result = await this.request<{ data: AttendanceRecord }>(
      `/attendances/${encodeURIComponent(id)}`,
    );
    const profiles = await this.getProfiles([result.data]);
    return { data: this.toResponse(result.data, profiles) };
  }

  async getPhoto(id: string, kind: string): Promise<{
    stream: Readable;
    contentType: string;
  }> {
    const response = await this.fetch(`${this.absensiUrl}/internal/attendances/${encodeURIComponent(id)}/photos/${encodeURIComponent(kind)}`);
    if (!response.ok) {
      await this.throwForResponse(response);
    }
    if (!response.body) {
      throw new BadGatewayException('Attendance service returned an empty photo response.');
    }

    return {
      stream: Readable.fromWeb(response.body),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async getDashboardSummary() {
    const today = getJakartaDate(new Date());
    const from = addDays(today, -6);
    const [summary, series] = await Promise.all([
      this.request<{ data: Record<string, number | string> }>(
        `/attendances/summary?date=${today}`,
      ),
      this.request<{ data: Array<Record<string, number | string>> }>(
        `/attendances/series?from=${from}&to=${today}`,
      ),
    ]);

    return { data: { ...summary.data, series: series.data } };
  }

  private async getProfiles(records: AttendanceRecord[]): Promise<Map<string, Employee>> {
    const ids = [...new Set(records.map(({ employeeId }) => employeeId))];
    const profiles = await this.employeesService.getAttendanceProfiles(ids);
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }

  private toResponse(record: AttendanceRecord, profiles: Map<string, Employee>) {
    const {
      checkInPhotoFileName,
      checkOutPhotoFileName,
      ...details
    } = record;
    return {
      ...details,
      checkInPhotoUrl: checkInPhotoFileName
        ? `/api/v1/attendances/${encodeURIComponent(record.id)}/photos/check-in`
        : null,
      checkOutPhotoUrl: checkOutPhotoFileName
        ? `/api/v1/attendances/${encodeURIComponent(record.id)}/photos/check-out`
        : null,
      employee: profiles.get(record.employeeId) ?? null,
    };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetch(
      `${this.absensiUrl}/internal${path}`,
      { headers: { 'x-internal-service-token': this.token } },
    );
    if (!response.ok) {
      await this.throwForResponse(response);
    }
    return response.json() as Promise<T>;
  }

  private async fetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await globalThis.fetch(url, init);
    } catch {
      throw new ServiceUnavailableException('Attendance service is unavailable.');
    }
  }

  private async throwForResponse(response: Response): Promise<never> {
    if (response.status === 404) {
      throw new NotFoundException('Attendance record was not found.');
    }
    if (response.status === 400) {
      throw new BadRequestException('Attendance query is invalid.');
    }
    throw new BadGatewayException('Attendance service request failed.');
  }
}

function getJakartaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
