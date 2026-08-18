import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LauncherVersionsFilterQuery {
  platform?: number;
  osArch?: number;
  gpu?: number;
  cuda?: number;
  launcherId?: number;
}

@Injectable()
export class LauncherVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async filter(query: LauncherVersionsFilterQuery = {}) {
    const where: Record<string, unknown> = {};
    if (query.platform !== undefined) where.platform = Number(query.platform);
    if (query.osArch !== undefined) where.osArch = Number(query.osArch);
    if (query.gpu !== undefined) where.gpu = Number(query.gpu);
    if (query.cuda !== undefined) where.cuda = Number(query.cuda);
    if (query.launcherId !== undefined) where.launcherId = Number(query.launcherId);

    return this.prisma.launcherVersion.findMany({
      where,
      orderBy: { id: 'desc' },
    });
  }
}