import { Module } from '@nestjs/common';
import { IngestModule } from '../ingest/ingest.module';
import { HandoverModule } from '../handover/handover.module';
import { HistoryModule } from '../history/history.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [IngestModule, HandoverModule, HistoryModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
