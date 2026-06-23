import { Body, Controller, Param, Post } from '@nestjs/common';
import { HandoverService } from './handover.service';

interface GenerateBody {
  shiftId?: string;
}

@Controller('hotels/:hotelId')
export class HandoverController {
  constructor(private readonly handover: HandoverService) {}

  /**
   * Generate the action-first handover for a hotel's shift (latest if none
   * given). All work is scoped to :hotelId.
   */
  @Post('handover')
  async generate(
    @Param('hotelId') hotelId: string,
    @Body() body: GenerateBody,
  ) {
    return this.handover.generate(hotelId, body?.shiftId);
  }
}
