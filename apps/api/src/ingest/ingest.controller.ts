import { Body, Controller, Post } from '@nestjs/common';
import { IngestRequestSchema } from '@vouch/schema';
import type { IngestRequest } from '@vouch/schema';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IngestService } from './ingest.service';

/**
 * Input arrives as data, not a file (BRIEF). hotelId travels in the body so a
 * single endpoint serves any hotel. STRUCTURED sources derive their shift
 * date(s) from the data; FREE_TEXT requires nightOf.
 */
@Controller('ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post()
  async ingestShift(
    @Body(new ZodValidationPipe(IngestRequestSchema)) body: IngestRequest,
  ) {
    return this.ingest.ingest(body.hotelId, body);
  }
}
