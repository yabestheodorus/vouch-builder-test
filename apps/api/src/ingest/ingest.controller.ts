import { Body, Controller, Post } from '@nestjs/common';
import { IngestShiftSchema } from '@vouch/schema';
import type { IngestShift } from '@vouch/schema';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IngestService } from './ingest.service';

/**
 * Input arrives as data, not a file (BRIEF). hotelId travels in the body so a
 * single endpoint serves any hotel; everything downstream is scoped by it.
 */
@Controller('ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post()
  async ingestShift(
    @Body(new ZodValidationPipe(IngestShiftSchema)) body: IngestShift,
  ) {
    return this.ingest.ingestShift(body.hotelId, body);
  }
}
