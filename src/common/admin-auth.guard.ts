import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('缺少 token');
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        admin: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('登录已失效');
    }
    if (session.admin.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    request.admin = session.admin;
    return true;
  }

  private extractToken(authorization?: string): string | undefined {
    if (!authorization) return undefined;
    const [scheme, token] = authorization.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}