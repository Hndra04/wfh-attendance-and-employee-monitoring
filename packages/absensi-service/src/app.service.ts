import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'absensi-service',
      timestamp: new Date().toISOString(),
    };
  }
}
