import { BadRequestException } from '@nestjs/common';

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

export function getJakartaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isLateCheckIn(date: Date, workStartTime: string): boolean {
  const [startHour, startMinute] = parseWorkStartTime(workStartTime);
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(timeParts.map(({ type, value }) => [type, value]));
  const localMinutes = Number(values.hour) * 60 + Number(values.minute);
  return localMinutes > startHour * 60 + startMinute;
}

export function parseWorkStartTime(value: string): [number, number] {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error('WORK_START_TIME must use the 24-hour HH:mm format.');
  }

  return [Number(match[1]), Number(match[2])];
}

export function assertDateRange(from?: string, to?: string): void {
  if (from && to && from > to) {
    throw new BadRequestException('The from date must be on or before the to date.');
  }
}

export function getDurationMinutes(checkInAt: Date | null, checkOutAt: Date | null): number | null {
  if (!checkInAt || !checkOutAt) {
    return null;
  }

  return Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60_000));
}
