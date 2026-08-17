import { genSalt, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 确保存在至少一个超级管理员（role=1）。
 * 仅在没有任何超级管理员时创建，凭据可通过环境变量配置。
 */
export async function ensureSuperAdmin(prisma: PrismaService) {
  const count = await prisma.admin.count({ where: { role: 1 } });
  if (count > 0) {
    return;
  }

  const username = process.env.ADMIN_INIT_USERNAME ?? 'admin';
  const password = process.env.ADMIN_INIT_PASSWORD ?? 'admin123';
  const salt = await genSalt(10);

  await prisma.admin.create({
    data: {
      username,
      password: await hash(password, salt),
      salt,
      nickname: '超级管理员',
      role: 1,
    },
  });
}