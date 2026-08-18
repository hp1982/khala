import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  role: true,
  status: true,
} as const;

const ACCOUNT_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  status: true,
} as const;

@Injectable()
export class DataAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const token = this.extractToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('缺少 token');
    }

    const adminSession = await this.prisma.adminSession.findUnique({
      where: { token },
      select: { expiresAt: true, admin: { select: ADMIN_SELECT } },
    });

    if (adminSession) {
      this.assertActive(adminSession.expiresAt, adminSession.admin.status);
      request.admin = adminSession.admin;
      return true;
    }

    const accountSession = await this.prisma.session.findUnique({
      where: { token },
      select: { expiresAt: true, account: { select: ACCOUNT_SELECT } },
    });

    if (!accountSession) {
      throw new UnauthorizedException('登录已失效');
    }
    this.assertActive(accountSession.expiresAt, accountSession.account.status);

    if (method !== 'GET') {
      throw new ForbiddenException('账号 token 仅允许读取（GET）操作');
    }

    request.account = accountSession.account;
    return true;
  }

  private assertActive(expiresAt: Date, status: number) {
    if (expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('登录已失效');
    }
    if (status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }
  }

  private extractToken(authorization?: string): string | undefined {
    if (!authorization) return undefined;
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}