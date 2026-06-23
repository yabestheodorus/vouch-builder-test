import { Module } from '@nestjs/common';
import { GroqService } from './groq.service';
import { HandoverGeneratorService } from './handover-generator.service';

@Module({
  providers: [GroqService, HandoverGeneratorService],
  exports: [HandoverGeneratorService],
})
export class LlmModule {}
