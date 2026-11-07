import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly token: string;

  constructor() {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token) {
      throw new Error('INTERNAL_SERVICE_TOKEN must be configured.');
    }
    this.token = token;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const suppliedToken = request.headers['x-internal-service-token'];
    if (typeof suppliedToken !== 'string') {
      throw new UnauthorizedException();
    }

    const expected = Buffer.from(this.token);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
