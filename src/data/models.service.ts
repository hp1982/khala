import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

export interface PagedModelsQuery {
  page?: number;
  pageSize?: number;
  id?: number;
  type?: number;
  name?: string;
  creatorId?: number;
  qorId?: number;
  launcherId?: number;
  adminId?: number;
}

const PUBLIC_ADMIN_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  role: true,
  status: true,
} as const;

const MODEL_INCLUDE: Prisma.ModelInclude = {
  creator: true,
  qor: true,
  launcher: true,
  admin: { select: PUBLIC_ADMIN_SELECT },
  mmprojs: { include: { weightFile: true } },
  draftModels: { include: { weightFile: true } },
  diffusionModels: { include: { weightFile: true } },
  quantizedModels: {
    include: { weightFile: true },
    orderBy: [{ weightFile: { qbit: 'asc' } }, { id: 'asc' }],
  },
};

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async paged(query: PagedModelsQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));

    const where: Record<string, unknown> = {};
    if (query.id !== undefined) where.id = Number(query.id);
    if (query.type !== undefined) where.type = Number(query.type);
    if (query.name) where.name = { contains: query.name };
    if (query.creatorId !== undefined) where.creatorId = Number(query.creatorId);
    if (query.qorId !== undefined) where.qorId = Number(query.qorId);
    if (query.launcherId !== undefined) where.launcherId = Number(query.launcherId);
    if (query.adminId !== undefined) where.adminId = Number(query.adminId);

    const [total, rawList] = await this.prisma.$transaction([
      this.prisma.model.count({ where }),
      this.prisma.model.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
        include: MODEL_INCLUDE,
      }),
    ]);

    const list = rawList.map((m) => ({
      ...m,
      quantizedModels: ModelsService.sortQuantizedByQbit(m.quantizedModels),
    }));

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private static parseSizeGB(size: string | null | undefined): number {
    if (size == null) return Number.POSITIVE_INFINITY;
    const n = parseFloat(size);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  private static sortQuantizedByQbit(list: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    if (!Array.isArray(list) || list.length < 2) return list;
    const groups = new Map<number, Array<Record<string, unknown>>>();
    for (const item of list) {
      const weightFile = (item as Record<string, unknown>).weightFile as Record<string, unknown> | null;
      const qbit = weightFile?.qbit as number | null | undefined;
      const key = qbit == null ? -1 : qbit;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === -1) return 1;
      if (b === -1) return -1;
      return a - b;
    });
    const result: Array<Record<string, unknown>> = [];
    for (const key of keys) {
      const items = groups.get(key)!.slice().sort((a, b) => {
        const weightFileA = a.weightFile as Record<string, unknown> | null;
        const weightFileB = b.weightFile as Record<string, unknown> | null;
        const sizeA = ModelsService.parseSizeGB(weightFileA?.size as string | null | undefined);
        const sizeB = ModelsService.parseSizeGB(weightFileB?.size as string | null | undefined);
        if (sizeA !== sizeB) return sizeA - sizeB;
        return (a.id as number) - (b.id as number);
      });
      result.push(...items);
    }
    return result;
  }
}