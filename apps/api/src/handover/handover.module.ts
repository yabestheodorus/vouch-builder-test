import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ReconcileModule } from '../reconcile/reconcile.module';
import { HandoverController } from './handover.controller';
import { HandoverService } from './handover.service';

@Module({
  imports: [LlmModule, ReconcileModule],
  controllers: [HandoverController],
  providers: [HandoverService],
  exports: [HandoverService],
})
export class HandoverModule {}
