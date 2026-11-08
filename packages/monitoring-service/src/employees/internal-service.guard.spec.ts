import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';

import { InternalServiceGuard } from './internal-service.guard';

describe('InternalServiceGuard', () => {
  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });

  it('accepts only the configured internal-service token', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'shared-test-token';
    const guard = new InternalServiceGuard();

    expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-internal-service-token': 'shared-test-token' } }),
        }),
      } as never),
    ).toBe(true);

    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-internal-service-token': 'wrong' } }),
        }),
      } as never),
    ).toThrow(UnauthorizedException);
  });
});
