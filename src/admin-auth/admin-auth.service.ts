import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { compare, genSalt, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminUpdateDto } from './dto/admin-update.dto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PUBLIC_ADMIN_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: AdminRegisterDto) {
    const exists = await this.prisma.admin.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
      select: { username: true, email: true },
    });

    if (exists) {
      const field = exists.username === dto.username ? '用户名' : '邮箱';
      throw new ConflictException(`${field}已被注册`);
    }

    const salt = await genSalt(10);
    const password = await hash(dto.password, salt);
    const role = dto.role === 1 ? 1 : 2;
    const status = dto.status === 1 || dto.status === 2 ? dto.status : 1;

    if (role === 1 && status === 1) {
      await this.assertNoOtherNormalSuperAdmin();
    }

    return this.prisma.admin.create({
      data: {
        username: dto.username,
        password,
        salt,
        nickname: dto.nickname ?? null,
        email: dto.email ?? null,
        role,
        status,
      },
      select: PUBLIC_ADMIN_SELECT,
    });
  }

  async login(dto: AdminLoginDto, meta: { userAgent?: string; ip?: string }) {
    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });

    const passwordOk =
      admin && (await compare(dto.password, admin.password));
    if (!admin || !passwordOk) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (admin.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: {
          token,
          adminId: admin.id,
          userAgent: meta.userAgent ?? null,
          ip: meta.ip ?? null,
          expiresAt,
        },
      }),
      this.prisma.admin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      token,
      expiresAt,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async logout(token?: string) {
    if (!token) {
      throw new UnauthorizedException('缺少 token');
    }
    await this.prisma.adminSession.deleteMany({ where: { token } });
    return { success: true };
  }

  async profile(token?: string) {
    if (!token) {
      throw new UnauthorizedException('缺少 token');
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { token },
      select: { admin: { select: PUBLIC_ADMIN_SELECT } },
    });

    if (!session || session.admin.status !== 1) {
      throw new UnauthorizedException('登录已失效');
    }

    return session.admin;
  }

  findAll() {
    return this.prisma.admin.findMany({ select: PUBLIC_ADMIN_SELECT });
  }

  async findOne(id: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: PUBLIC_ADMIN_SELECT,
    });
    if (!admin) {
      throw new NotFoundException(`管理员 ${id} 不存在`);
    }
    return admin;
  }

  async update(id: number, dto: AdminUpdateDto, current: Express.Request['admin']) {
    if ((dto.role !== undefined || dto.status !== undefined) && current?.role !== 1) {
      throw new ForbiddenException('仅超级管理员可修改角色或状态');
    }

    const existing = await this.prisma.admin.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`管理员 ${id} 不存在`);
    }

    const newRole = dto.role !== undefined ? (dto.role === 1 ? 1 : 2) : existing.role;
    const newStatus =
      dto.status !== undefined ? (dto.status === 1 || dto.status === 2 ? dto.status : existing.status) : existing.status;

    const wasNormalSuper = existing.role === 1 && existing.status === 1;
    const willBeNormalSuper = newRole === 1 && newStatus === 1;

    if (willBeNormalSuper && !wasNormalSuper) {
      await this.assertNoOtherNormalSuperAdmin(id);
    }
    if (wasNormalSuper && !willBeNormalSuper) {
      await this.assertOtherNormalSuperAdminExists(id);
    }

    const data: Record<string, unknown> = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = newRole;
    if (dto.status !== undefined) data.status = newStatus;
    if (dto.password) {
      const salt = await genSalt(10);
      data.salt = salt;
      data.password = await hash(dto.password, salt);
    }

    await this.prisma.admin.update({ where: { id }, data });
    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.prisma.admin.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`管理员 ${id} 不存在`);
    }
    if (existing.role === 1 && existing.status === 1) {
      await this.assertOtherNormalSuperAdminExists(id);
    }
    await this.prisma.adminSession.deleteMany({ where: { adminId: id } });
    await this.prisma.admin.delete({ where: { id } });
    return { success: true };
  }

  private async countNormalSuperAdmins(excludeId?: number): Promise<number> {
    return this.prisma.admin.count({
      where: {
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
        role: 1,
        status: 1,
      },
    });
  }

  private async assertNoOtherNormalSuperAdmin(excludeId?: number) {
    const count = await this.countNormalSuperAdmins(excludeId);
    if (count >= 1) {
      throw new ConflictException('已存在状态正常的超级管理员');
    }
  }

  private async assertOtherNormalSuperAdminExists(excludeId: number) {
    const count = await this.countNormalSuperAdmins(excludeId);
    if (count === 0) {
      throw new ForbiddenException('至少需要保留一个状态正常的超级管理员');
    }
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}