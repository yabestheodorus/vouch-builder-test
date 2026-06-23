import { Global, Module } from '@nestjs/common';
import { GenerationLogService } from './generation-log.service';

@Global()
@Module({
  providers: [GenerationLogService],
  exports: [GenerationLogService],
})
export class LoggingModule {}
