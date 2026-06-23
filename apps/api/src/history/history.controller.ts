import { Controller, Get, Param } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('hotels/:hotelId')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get('handovers')
  listHandovers(@Param('hotelId') hotelId: string) {
    return this.history.listHandovers(hotelId);
  }

  @Get('handovers/:id')
  getHandover(@Param('hotelId') hotelId: string, @Param('id') id: string) {
    return this.history.getHandover(hotelId, id);
  }

  @Get('raw-logs')
  listRawLogs(@Param('hotelId') hotelId: string) {
    return this.history.listRawLogs(hotelId);
  }

  @Get('generation-logs')
  listGenerationLogs(@Param('hotelId') hotelId: string) {
    return this.history.listGenerationLogs(hotelId);
  }
}
