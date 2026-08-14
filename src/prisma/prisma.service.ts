import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly dbUrl: string;

  constructor() {
    const dbUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? ':memory:';
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    super({ adapter });
    this.dbUrl = dbUrl;
  }

  async onModuleInit() {
    await this.$connect();
    if (this.isInMemory()) {
      await this.applyMigrationsFromDisk();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private isInMemory(): boolean {
    return !/^file:/.test(this.dbUrl) || this.dbUrl.includes(':memory:');
  }

  private async applyMigrationsFromDisk() {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    if (!existsSync(migrationsDir)) {
      this.logger.warn('未找到 prisma/migrations 目录，请先运行 npx prisma migrate dev --name init');
      return;
    }

    const folders = readdirSync(migrationsDir)
      .filter((name) => /^\d+_/.test(name))
      .sort();

    for (const folder of folders) {
      const sql = readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
      const statements = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await this.$executeRawUnsafe(statement);
      }
      this.logger.log(`已应用迁移 ${folder} 到内存数据库`);
    }
  }
}