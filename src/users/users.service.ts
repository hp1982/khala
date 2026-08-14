import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { UserModel } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateUserDto) {
    const user = await this.prisma.user.create({ data: dto });
    await this.cacheManager.del(this.cacheKey(user.id));
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: number) {
    const cacheKey = this.cacheKey(id);
    const cached = await this.cacheManager.get<UserModel>(cacheKey);
    if (cached) {
      this.logger.log(`命中缓存 ${cacheKey}`);
      return cached;
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }

    await this.cacheManager.set(cacheKey, user, 60_000);
    this.logger.log(`已写入缓存 ${cacheKey}`);
    return user;
  }

  async remove(id: number) {
    await this.cacheManager.del(this.cacheKey(id));
    return this.prisma.user.delete({ where: { id } });
  }

  private cacheKey(id: number) {
    return `user:${id}`;
  }
}