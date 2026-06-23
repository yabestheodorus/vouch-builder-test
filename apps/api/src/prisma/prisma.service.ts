import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 uses a driver adapter (no bundled query engine). We use the
 * better-sqlite3 adapter against the file DB. UTF-8 throughout (AGENTS.md §3.2).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaBetterSqlite3({
        url: process.env.DATABASE_URL ?? 'file:./dev.db',
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected (better-sqlite3 adapter)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
