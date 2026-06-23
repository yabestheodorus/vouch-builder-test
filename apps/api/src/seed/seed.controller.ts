import { Controller, Param, Post } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('hotels/:hotelId')
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  /** Clear this hotel and reload the bundled sample week (demo convenience). */
  @Post('seed')
  reseed(@Param('hotelId') hotelId: string) {
    return this.seed.reseed(hotelId);
  }
}
