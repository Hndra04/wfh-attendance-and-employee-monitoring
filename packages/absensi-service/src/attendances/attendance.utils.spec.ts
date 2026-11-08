import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertDateRange,
  getDurationMinutes,
  getJakartaDate,
  isLateCheckIn,
  parseWorkStartTime,
} from './attendance.utils';

describe('attendance utilities', () => {
  it('derives the business date in Jakarta regardless of server timezone', () => {
    expect(getJakartaDate(new Date('2026-11-06T17:30:00.000Z'))).toBe('2026-11-07');
  });

  it('marks check-in late only after the configured local start time', () => {
    expect(isLateCheckIn(new Date('2026-11-06T02:00:00.000Z'), '09:00')).toBe(false);
    expect(isLateCheckIn(new Date('2026-11-06T02:01:00.000Z'), '09:00')).toBe(true);
  });

  it('rejects invalid work start time values', () => {
    expect(() => parseWorkStartTime('9:00')).toThrow(
      'WORK_START_TIME must use the 24-hour HH:mm format.',
    );
  });

  it('rejects an inverted attendance date range', () => {
    expect(() => assertDateRange('2026-11-07', '2026-11-06')).toThrow(
      BadRequestException,
    );
  });

  it('returns duration only after check-out', () => {
    expect(getDurationMinutes(new Date('2026-11-06T02:00:00Z'), null)).toBeNull();
    expect(
      getDurationMinutes(
        new Date('2026-11-06T02:00:00Z'),
        new Date('2026-11-06T10:30:00Z'),
      ),
    ).toBe(510);
  });
});
