import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash, compare, genSalt } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PUBLIC_ACCOUNT_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.account.findFirst({
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
    const passwordHash = await hash(dto.password, salt);
    const account = await this.prisma.account.create({
      data: {
        username: dto.username,
        password: passwordHash,
        salt,
        nickname: dto.nickname ?? null,
        email: dto.email ?? null,
      },
      select: PUBLIC_ACCOUNT_SELECT,
    });

    return account;
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const account = await this.prisma.account.findUnique({
      where: { username: dto.username },
    });

    const passwordOk =
      account && (await compare(dto.password, account.password));
    if (!account || !passwordOk) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (account.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.session.create({
        data: {
          token,
          accountId: account.id,
          userAgent: meta.userAgent ?? null,
          ip: meta.ip ?? null,
          expiresAt,
        },
      }),
      this.prisma.account.update({
        where: { id: account.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      token,
      expiresAt,
      account: {
        id: account.id,
        username: account.username,
        nickname: account.nickname,
        email: account.email,
      },
    };
  }

  async logout(token?: string) {
    if (!token) {
      throw new UnauthorizedException('缺少 token');
    }
    await this.prisma.session.deleteMany({ where: { token } });
    return { success: true };
  }

  async profile(token?: string) {
    if (!token) {
      throw new UnauthorizedException('缺少 token');
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      select: { account: { select: PUBLIC_ACCOUNT_SELECT } },
    });

    if (!session || session.account.status !== 1) {
      throw new UnauthorizedException('登录已失效');
    }

    return session.account;
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}
