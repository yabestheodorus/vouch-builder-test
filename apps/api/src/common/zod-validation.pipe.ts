import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Parse, don't trust (AGENTS.md §3.2). Validates request input against a Zod
 * schema at the HTTP boundary. Intentionally non-generic: the parsed value's
 * static type comes from the controller parameter annotation, which avoids deep
 * generic instantiation over large Zod schemas (TS2589).
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Request validation failed',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
