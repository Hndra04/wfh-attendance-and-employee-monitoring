import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';

import { InternalServiceGuard } from './internal-service.guard';

describe('InternalServiceGuard', () => {
  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
  });

  it('accepts a matching service token and rejects absent or mismatched tokens', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'a-secret-token';
    const guard = new InternalServiceGuard();
    const context = (token?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: token ? { 'x-internal-service-token': token } : {},
          }),
        }),
      }) as never;

    expect(guard.canActivate(context('a-secret-token'))).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('wrong-token'))).toThrow(UnauthorizedException);
  });
});
