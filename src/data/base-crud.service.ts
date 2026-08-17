import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PrismaModelKey =
  | 'weightFile'
  | 'model'
  | 'mmproj'
  | 'draftModel'
  | 'diffusionModel'
  | 'quantizedModel'
  | 'creator'
  | 'qor'
  | 'country'
  | 'launcher'
  | 'launcherVersion';

@Injectable()
export class BaseCrudService {
  private readonly delegate: any;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelKey: PrismaModelKey,
  ) {
    this.delegate = (prisma as any)[modelKey];
  }

  create(dto: any, adminId?: number) {
    return this.delegate.create({
      data: {
        ...dto,
        ...(adminId !== undefined ? { adminId } : {}),
      },
    });
  }

  findAll() {
    return this.delegate.findMany();
  }

  async findOne(id: number) {
    const record = await this.delegate.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`记录 ${id} 不存在`);
    }
    return record;
  }

  update(id: number, dto: any) {
    const { adminId, createdAt, updatedAt, ...data } = dto ?? {};
    return this.delegate.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.delegate.delete({ where: { id } });
  }
}