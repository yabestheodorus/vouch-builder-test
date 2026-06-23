import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health(): { status: string; service: string; time: string } {
    return {
      status: 'ok',
      service: 'vouch-frontdesk-hotel-log',
      time: new Date().toISOString(),
    };
  }
}
