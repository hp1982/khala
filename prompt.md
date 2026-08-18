# Khala 项目完整实现规格说明书

> 本文档为 Khala 后端项目的**唯一实现依据**。任何开发者仅凭本文档即可从零完整复刻该项目当前的全部功能（包括行为细节、业务规则、接口约定与已知实现坑点）。

---

## 1. 项目概述

Khala 是一个面向「大模型 / 权重文件 / 启动器」资源管理后台的 **NestJS 服务端项目**，提供：

- **两套独立的账号体系**：
  - **管理员体系（`/admin`）**：可读写全部业务数据，管理管理员；超级管理员拥有删除权限。
  - **账号体系（`/auth`）**：独立注册登录，其 token 为**只读**，只能访问 GET 接口。
- **11 张业务表**的通用 CRUD 接口 + 2 个定制查询接口（模型分页关联查询、启动器版本条件筛选）。
- 内置缓存（Redis 内存模拟）、SQLite 持久化（Prisma 7 + better-sqlite3 适配器）。

---

## 2. 技术栈与依赖

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | NestJS（`@nestjs/core`、`@nestjs/common`、`@nestjs/platform-express`） | ^10.4.15 |
| ORM | Prisma Client + `@prisma/adapter-better-sqlite3` | ^7.9.1 |
| 数据库 | better-sqlite3（嵌入式 SQLite） | ^13.0.3 |
| 密码哈希 | bcryptjs（`genSalt` / `hash` / `compare`，cost=10） | ^3.0.3 |
| 缓存 | `@nestjs/cache-manager` + `cache-manager` + 自研 `RedisMockStore`（基于 `ioredis-mock`） | ^3.1.3 / ^7.2.9 |
| 环境变量 | dotenv | ^17.4.2 |
| 语言/构建 | TypeScript ^5.7.2、tsconfig、nest-cli | - |

关键点：
- Prisma 使用 `prisma-client` generator，输出到 `src/generated/prisma`。
- Prisma 通过 `defineConfig`（`prisma.config.ts`）读取 `DATABASE_URL` 作为 CLI 数据源。
- 依赖中 `allowScripts` 允许 `better-sqlite3` / `@prisma/engines` 安装脚本（Windows 下必需）。

---

## 3. 环境与配置

### 3.1 `.env` / `.env.example`

```ini
# Prisma CLI 使用（migrate dev / db push），文件型 SQLite，迁移可持久化
DATABASE_URL="file:./prisma/dev.db"

# 运行时数据库：文件型 SQLite（重启数据持久）或 :memory:（进程内、每次启动全新）
APP_DATABASE_URL="file:./prisma/dev.db"
# APP_DATABASE_URL=":memory:"   # 开发期可选，启动时自动按迁移 SQL 建表

# 初始超级管理员：启动时若不存在 role=1 管理员则自动创建
ADMIN_INIT_USERNAME="admin"
ADMIN_INIT_PASSWORD="admin123"
```

### 3.2 `prisma.config.ts`

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

### 3.3 `package.json` 关键脚本

```json
"build": "nest build",
"start": "nest start",
"start:prod": "node dist/main",
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate dev",
"prisma:deploy": "prisma migrate deploy",
"prisma:push": "prisma db push",
"prisma:studio": "prisma studio"
```

### 3.4 `tsconfig.json` 要点

`target: ES2021`、`module: commonjs`、`emitDecoratorMetadata/experimentalDecorators: true`、`strictNullChecks: false`、`outDir: ./dist`、`incremental: true`。

---

## 4. 目录结构（src）

```
src/
├── main.ts                      # 启动引导（dotenv → NestFactory → app.init → 种子超管 → listen）
├── app.module.ts                # 根模块（Prisma、全局 Cache、Auth、AdminAuth、Data）
├── app.controller.ts            # GET / 健康检查（返回 "Hello World!"）
├── app.service.ts
├── types/express.d.ts           # 扩展 Express.Request：admin? / account?
├── prisma/
│   ├── prisma.module.ts         # @Global 模块，提供 PrismaService
│   └── prisma.service.ts        # PrismaClient(better-sqlite3 adapter)；内存库时自动应用迁移
├── cache/redis-mock.store.ts    # ioredis-mock 实现的 KeyvStoreAdapter（开发缓存）
├── auth/                        # 账号体系
│   ├── auth.module.ts
│   ├── auth.controller.ts       # /auth/register|login|logout|profile
│   ├── auth.service.ts
│   └── dto/{login,register}.dto.ts
├── admin-auth/                  # 管理员体系
│   ├── admin-auth.module.ts
│   ├── admin-auth.controller.ts # /admin/login|register|logout|profile|GET|GET:id|PUT:id|DELETE:id
│   ├── admin-auth.service.ts    # 含超级管理员状态约束逻辑
│   ├── seed.ts                  # ensureSuperAdmin
│   └── dto/{admin-login,admin-register,admin-update}.dto.ts
├── data/                        # 业务数据
│   ├── data.module.ts           # 注册 11 个 CRUD 控制器 + ModelsController + LauncherVersionsController
│   ├── base-crud.service.ts     # 通用 CRUD（create/findAll/findOne/update/remove）
│   ├── crud.controller.factory.ts # createCrudController() 工厂（POST/GET/GET:id/PUT/DELETE:id）
│   ├── models.controller.ts     # GET /models/paged
│   ├── models.service.ts        # 分页 + 关联查询 + quantizedModels 按 qbit 分组排序
│   ├── launcher-versions.controller.ts # GET /launcher-versions/filter
│   └── launcher-versions.service.ts    # 条件筛选
└── common/                      # 鉴权体系
    ├── admin-auth.guard.ts      # 管理员 token 校验
    ├── data-access.guard.ts     # 业务数据守卫（管理员全方法 / 账号 token 仅 GET）
    ├── roles.guard.ts           # @Roles 元数据校验
    ├── roles.decorator.ts       # @Roles(...roles)
    └── current-admin.decorator.ts # @CurrentAdmin()
```

---

## 5. 数据模型（`prisma/schema.prisma`）

generator 配置：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
datasource db { provider = "sqlite" }
```

> 注意：`User` / `Post` 两个模型是脚手架遗留示例，**保留在 schema 中但无任何接口**，重建时应一并保留（或移除，不影响接口）。

### 5.1 账号体系

```prisma
model Account {
  id          Int       @id @default(autoincrement())
  username    String    @unique
  password    String                  // bcrypt 哈希
  salt        String                  // 注册时生成的加盐随机数
  nickname    String?
  email       String?   @unique
  status      Int       @default(1)   // 1=正常 2=禁用
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  sessions    Session[]
}

model Session {
  id        Int      @id @default(autoincrement())
  token     String   @unique          // 登录时签发的随机 token
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  accountId Int
  userAgent String?
  ip        String?
  expiresAt DateTime                   // 过期时间（7 天）
  createdAt DateTime @default(now())
  @@index([accountId])
}
```

### 5.2 管理员体系

```prisma
model Admin {
  id               Int       @id @default(autoincrement())
  username         String    @unique
  password         String    // bcrypt 哈希
  salt             String
  nickname         String?
  email            String?   @unique
  role             Int       @default(2) // 1=超级管理员 2=普通管理员
  status           Int       @default(1) // 1=正常 2=禁用
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  sessions         AdminSession[]
  weightFiles      WeightFile[]
  models           Model[]
  mmprojs          Mmproj[]
  draftModels      DraftModel[]
  diffusionModels  DiffusionModel[]
  quantizedModels  QuantizedModel[]
  creators         Creator[]
  qors             Qor[]
  countries        Country[]
  launchers        Launcher[]
  launcherVersions LauncherVersion[]
}

model AdminSession {
  id        Int      @id @default(autoincrement())
  token     String   @unique
  admin     Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)
  adminId   Int
  userAgent String?
  ip        String?
  expiresAt DateTime // 过期时间（7 天）
  createdAt DateTime @default(now())
  @@index([adminId])
}
```

### 5.3 业务表（11 张）

```prisma
model WeightFile {
  id              Int       @id @default(autoincrement())
  name            String?   @unique
  size            String?
  hashType        Int?
  downloadAddress String?
  fileHash        String?
  qbit            Int?
  isSplit         Boolean   @default(false)
  type            Int       @default(0) // 0=quantized_model 1=mmproj 2=draft_model 3=diffusion_model_text_frames 4=diffusion_model_references 5=prompt_llm 6=audio_vae 7=video-vae
  admin           Admin     @relation(fields: [adminId], references: [id])
  adminId         Int
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  mmprojs         Mmproj[]
  draftModels     DraftModel[]
  diffusionModels DiffusionModel[]
  quantizedModels QuantizedModel[]
  @@map("weight_file")
}

model Model {
  id              Int                @id @default(autoincrement())
  name            String?
  type            Int? // 1：Image-Text-to-Text，2：Image-Text-to-Video
  parameter       String?
  contextWindows  Int?
  hasDraft        Int?
  hasMmproj       Int?
  hasDiffusion    Int                @default(0)
  creator         Creator?           @relation(fields: [creatorId], references: [id])
  creatorId       Int?
  qor             Qor?               @relation(fields: [qorId], references: [id])
  qorId           Int?
  launcher        Launcher?          @relation(fields: [launcherId], references: [id])
  launcherId      Int?
  admin           Admin              @relation(fields: [adminId], references: [id])
  adminId         Int
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  mmprojs         Mmproj[]
  draftModels     DraftModel[]
  diffusionModels DiffusionModel[]
  quantizedModels QuantizedModel[]
  @@map("model")
}

model Mmproj {
  id           Int        @id @default(autoincrement())
  model        Model      @relation(fields: [modelId], references: [id])
  modelId      Int
  weightFile   WeightFile @relation(fields: [weightFileId], references: [id])
  weightFileId Int
  admin        Admin      @relation(fields: [adminId], references: [id])
  adminId      Int
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@map("mmproj")
}

model DraftModel {
  id           Int        @id @default(autoincrement())
  model        Model      @relation(fields: [modelId], references: [id])
  modelId      Int
  weightFile   WeightFile @relation(fields: [weightFileId], references: [id])
  weightFileId Int
  admin        Admin      @relation(fields: [adminId], references: [id])
  adminId      Int
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@map("draft_model")
}

model DiffusionModel {
  id           Int        @id @default(autoincrement())
  model        Model      @relation(fields: [modelId], references: [id])
  modelId      Int
  weightFile   WeightFile @relation(fields: [weightFileId], references: [id])
  weightFileId Int
  type         Int? // 1：text_frames，2：references，3：llm，4：audio_vae，5：video-vae
  admin        Admin      @relation(fields: [adminId], references: [id])
  adminId      Int
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@map("diffusion_model")
}

model QuantizedModel {
  id           Int        @id @default(autoincrement())
  model        Model      @relation(fields: [modelId], references: [id])
  modelId      Int
  weightFile   WeightFile @relation(fields: [weightFileId], references: [id])
  weightFileId Int
  admin        Admin      @relation(fields: [adminId], references: [id])
  adminId      Int
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@map("quantized_model")
}

model Creator {
  id        Int      @id @default(autoincrement())
  name      String?
  country   Country? @relation(fields: [countryId], references: [id])
  countryId Int?
  admin     Admin    @relation(fields: [adminId], references: [id])
  adminId   Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  models    Model[]
  @@map("creator")
}

model Qor {
  id        Int      @id @default(autoincrement())
  name      String?
  country   Country? @relation(fields: [countryId], references: [id])
  countryId Int?
  admin     Admin    @relation(fields: [adminId], references: [id])
  adminId   Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  models    Model[]
  @@map("qor")
}

model Country {
  id        Int       @id @default(autoincrement())
  name      String?
  admin     Admin     @relation(fields: [adminId], references: [id])
  adminId   Int
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  creators  Creator[]
  qors      Qor[]
  @@map("country")
}

model Launcher {
  id              Int               @id @default(autoincrement())
  name            String?
  icon            Bytes?            // BLOB
  admin           Admin             @relation(fields: [adminId], references: [id])
  adminId         Int
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  models          Model[]
  launcherVersion LauncherVersion[]
  @@map("launcher")
}

model LauncherVersion {
  id                   Int      @id @default(autoincrement())
  platform             Int? // 1:win32 2:macos 3:linux
  osArch               Int? // 1:x64 2:arm64
  gpu                  Int? // 1:NVIDIA 2:AMD 3:INTEL
  cuda                 Int?
  name                 String?
  version              String?
  downloadAddress      String?
  extraDownloadAddress String?
  launcher             Launcher @relation(fields: [launcherId], references: [id])
  launcherId           Int
  admin                Admin    @relation(fields: [adminId], references: [id])
  adminId              Int
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  @@map("launcher_version")
}
```

---

## 6. 数据库迁移历史（`prisma/migrations`）

按时间排序，重建时可用 `prisma migrate deploy`（需维护 `migration_lock.toml`）：

| 迁移 | 内容 |
|------|------|
| `20260814055832_init` | 脚手架 User/Post + 基础表 |
| `20260814114349_add_account_auth` | Account/Session 表 |
| `20260817164223_add_admin_permission_data_tables` | Admin/AdminSession + 11 业务表（早期含 Permission 表） |
| `20260817185325_add_is_split_to_quantized_model` | （已回滚）quantized_model.isSplit |
| `20260817191309_remove_is_split_from_quantized_model` | 回滚 isSplit |
| `20260817191646_add_is_split_to_weight_file` | weight_file.isSplit（`ALTER TABLE ADD COLUMN isSplit BOOLEAN NOT NULL DEFAULT false`） |
| `20260817192426_remove_permission_table` | 删除 Permission 表 |
| `20260818031932_add_type_to_weight_file` | weight_file.type（`ADD COLUMN type INTEGER NOT NULL DEFAULT 0`，RedefineTables 方式） |
| `20260818133117_add_download_address_to_launcher_version` | launcher_version.downloadAddress / extraDownloadAddress（`ADD COLUMN ... TEXT`） |

> 业务结论：**当前 schema 不含 Permission 表**，`/permissions` 接口不存在（404）。

---

## 7. 启动引导（`src/main.ts` + 种子）

```ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { ensureSuperAdmin } from './admin-auth/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();                 // ★ 必须显式 init，否则生命周期钩子不触发
  const prisma = app.get(PrismaService);
  await ensureSuperAdmin(prisma);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**`seed.ts`（ensureSuperAdmin）**：统计 `role=1` 管理员数量，若为 0 则用 `ADMIN_INIT_USERNAME/PASSWORD`（默认 admin/admin123）创建 `role=1` 超级管理员。**仅在没有任何超级管理员时创建。**

**PrismaService（`prisma.service.ts`）关键逻辑**：

- 构造：`dbUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? ':memory:'`；用 `new PrismaBetterSqlite3({ url: dbUrl })` 适配器创建 PrismaClient。
- `isInMemory()`：`!/^file:/.test(dbUrl) || dbUrl.includes(':memory:')`。
- `onModuleInit()`：`$connect()`；若为内存库，则遍历 `prisma/migrations` 下 `^\d+_` 文件夹，按 `migration.sql` 用 `$executeRawUnsafe` 逐条执行（分号切分、过滤空语句），实现「内存库自动建表」。

---

## 8. 认证与鉴权体系（`src/common`）

### 8.1 Express 类型扩展（`src/types/express.d.ts`）

```ts
declare global {
  namespace Express {
    interface Request {
      admin?: { id: number; username: string; nickname: string | null; email: string | null; role: number; status: number };
      account?: { id: number; username: string; nickname: string | null; email: string | null; status: number };
    }
  }
}
```

### 8.2 三个守卫

**`AdminAuthGuard`**（管理员 token）：从 `Authorization: Bearer <token>` 取 token，缺失抛 `401 '缺少 token'`；查 `adminSession`（含 admin 公开字段），无效/过期抛 `401 '登录已失效'`；`admin.status !== 1` 抛 `401 '账号已被禁用'`；成功则 `request.admin = ...`。

**`DataAccessGuard`**（业务数据守卫，`src/common/data-access.guard.ts`）：
1. 取 token，缺失抛 `401 '缺少 token'`。
2. 先查 `adminSession`：命中则校验过期/禁用，设 `request.admin`，**放行任意方法**。
3. 未命中则查 `session`（账号会话）：无效/过期抛 `401 '登录已失效'`；账号被禁用抛 `401 '账号已被禁用'`。
4. **账号 token 命中后：若 `request.method !== 'GET'` 抛 `403 '账号 token 仅允许读取（GET）操作'`**；否则设 `request.account` 放行。

**`RolesGuard`**：读取 `@Roles()` 元数据，为空放行；否则要求 `request.admin.role` 在允许列表内，不在则抛 `403 '仅超级管理员可执行该操作'`。

### 8.3 装饰器

- `@Roles(...roles: number[])`：SetMetadata('roles', roles)。
- `@CurrentAdmin()`：取 `request.admin`。

### 8.4 两类 token 权限总表

| 能力 | 管理员 token（`/admin/login`） | 账号 token（`/auth/login`） |
|------|------|------|
| 业务数据 GET（列表/详情/paged/filter） | ✅ | ✅（只读） |
| 业务数据 POST/PUT | ✅ | ❌ `403` |
| 业务数据 DELETE | 仅超级管理员 `role=1` | ❌ `403` |
| `/admin` 管理接口 | ✅ | ❌（`AdminAuthGuard` 不认账号 token，`401`） |
| `/auth/profile`、`/auth/logout` | - | ✅ |

---

## 9. 模块详解

### 9.1 `AppModule`

```ts
@Module({
  imports: [
    PrismaModule,                       // @Global
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({ stores: [new RedisMockStore()], ttl: 60_000 }),
    }),
    AuthModule,
    AdminAuthModule,
    DataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
```

**`RedisMockStore`**（`cache/redis-mock.store.ts`）：基于 `ioredis-mock` 的 `KeyvStoreAdapter`（EventEmitter），实现 `get/set(ttl 毫秒 PX)/delete/clear/has/disconnect`。

### 9.2 `PrismaModule`

`@Global()`，提供并导出 `PrismaService`。

### 9.3 账号模块（`auth`）

接口：见 §10.1。业务逻辑要点：

- **register**：先按 username/email（OR）查重，冲突抛 `409 '{用户名|邮箱}已被注册'`；`genSalt(10)` + `hash` 存密码；返回公开字段。
- **login**：按 username 查；`compare` 失败或账号不存在抛 `401 '用户名或密码错误'`；`status !== 1` 抛 `401 '账号已被禁用'`；签发 `randomBytes(32).toString('hex')` token，`expiresAt = now + 7天`，`$transaction` 内创建 Session 并更新 `lastLoginAt`；记录 `userAgent` / `ip`（优先 `x-forwarded-for`）。
- **logout**：按 token 删除 Session，无 token 抛 `401 '缺少 token'`。
- **profile**：按 token 查 Session（含 account 公开字段），无效或禁用抛 `401 '登录已失效'`。

> DTO：`LoginDto{username,password}`、`RegisterDto{username,password,nickname?,email?}`（无校验器，纯类型）。

### 9.4 管理员模块（`admin-auth`）

接口：见 §10.2。业务逻辑要点：

- **register**：查重（username/email OR），冲突 `409`；`role = dto.role === 1 ? 1 : 2`；`status = [1,2].includes(dto.status) ? dto.status : 1`；**若 `role===1 && status===1`，先调用 `assertNoOtherNormalSuperAdmin()`（见 §11.1）**。
- **login**：同账号逻辑（查 `admin` 表、建 `adminSession`、更新 lastLoginAt），返回 `{token, expiresAt, admin:{id,username,nickname,email,role}}`。
- **logout**：删除 adminSession。
- **profile**：按 token 查 session（admin 公开字段），无效/禁用抛 `401`。
- **findAll**：`admin.findMany(select 公开字段)`。
- **findOne**：按 id，不存在 `404 '管理员 ${id} 不存在'`。
- **update**（详见 §11.1 与下方代码）：改 role/status 需超级管理员；含超级管理员唯一性/保底校验。
- **remove**：删除最后正常超管会被拦截；先删该管理员所有 session，再删 admin。

### 9.5 数据模块（`data`）

**通用 CRUD 工厂**（`crud.controller.factory.ts`）：

```ts
export function createCrudController({ route, modelKey }): Type<any> {
  @Controller(route)
  @UseGuards(DataAccessGuard)
  class CrudController {
    @Post()     create(@Body() dto, @CurrentAdmin() admin) // service.create(dto, admin?.id)
    @Get()      findAll()                                   // service.findAll()
    @Get(':id') findOne(@Param('id', ParseIntPipe) id)      // service.findOne(id)
    @Put(':id') update(@Param('id', ParseIntPipe) id, @Body() dto) // service.update(id, dto)
    @Delete(':id') @Roles(1) @UseGuards(RolesGuard) remove()        // service.remove(id)
  }
}
```

**`BaseCrudService`**：
- `create(dto, adminId)`：`delegate.create({ data: { ...dto, ...(adminId !== undefined ? { adminId } : {}) } })`。
- `findAll()`：`findMany()`。
- `findOne(id)`：不存在抛 `404 '记录 ${id} 不存在'`。
- `update(id, dto)`：剔除 `adminId/createdAt/updatedAt` 后 update。
- `remove(id)`：delete。

**11 个路由注册**（`data.module.ts`），注意顺序（★ 静态路由控制器必须排在其 CRUD 控制器之前，否则被 `GET/:id` 遮蔽）：

```ts
controllers: [
  ModelsController,             // ★ 必须在 models CRUD 之前
  LauncherVersionsController,   // ★ 必须在 launcher-versions CRUD 之前
  createCrudController({ route: 'weight-files', modelKey: 'weightFile' }),
  createCrudController({ route: 'models', modelKey: 'model' }),
  createCrudController({ route: 'mmprojs', modelKey: 'mmproj' }),
  createCrudController({ route: 'draft-models', modelKey: 'draftModel' }),
  createCrudController({ route: 'diffusion-models', modelKey: 'diffusionModel' }),
  createCrudController({ route: 'quantized-models', modelKey: 'quantizedModel' }),
  createCrudController({ route: 'creators', modelKey: 'creator' }),
  createCrudController({ route: 'qors', modelKey: 'qor' }),
  createCrudController({ route: 'countries', modelKey: 'country' }),
  createCrudController({ route: 'launchers', modelKey: 'launcher' }),
  createCrudController({ route: 'launcher-versions', modelKey: 'launcherVersion' }),
],
providers: [ModelsService, LauncherVersionsService],
```

**`/models/paged`（`models.service.ts`）**：

- 参数：`page`(默认1)、`pageSize`(默认10，`min(100, max(1,...))`)、`id/type/creatorId/qorId/launcherId/adminId`(精确)、`name`(模糊 `contains`)。
- `page = Math.max(1, Number(page)||1)`；`pageSize = Math.min(100, Math.max(1, Number(pageSize)||10))`。
- `$transaction([count, findMany])`，`findMany` 带 `skip/take/orderBy:{id:'desc'}`。
- include 结构（关键）：

```ts
const MODEL_INCLUDE: Prisma.ModelInclude = {
  creator: true,
  qor: true,
  launcher: true,
  admin: { select: { id:true, username:true, nickname:true, email:true, role:true, status:true } },
  mmprojs: { include: { weightFile: true } },
  draftModels: { include: { weightFile: true } },
  diffusionModels: { include: { weightFile: true } },
  quantizedModels: {
    include: { weightFile: true },
    orderBy: [{ weightFile: { qbit: 'asc' } }, { id: 'asc' }],
  },
};
```

- 返回 `{ list, total, page, pageSize, totalPages: Math.ceil(total/pageSize) }`。
- **`quantizedModels` 二次排序**：`sortQuantizedByQbit()` 按 `weightFile.qbit` 分组（qbit 升序，无 qbit 排最后），组内按 `weightFile.size` **数值**升序（size 是字符串，如 `"10.7"`，用 `parseFloat`，解析失败按正无穷），同组同 size 按 id 升序。

**`/launcher-versions/filter`（`launcher-versions.service.ts`）**：

- 参数：`platform/osArch/gpu/cuda/launcherId` 可选，`Number()` 精确筛选，可组合。
- 返回数组（**无分页**），`orderBy: { id: 'desc' }`。

---

## 10. 完整 API 接口清单

通用：`Authorization: Bearer <token>`；无校验器，参数直接透传。

### 10.1 系统

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 无 | 健康检查，返回 `"Hello World!"` |

### 10.2 账号（`/auth`）

| 方法 | 路径 | 认证 | 请求体 | 返回/说明 |
|------|------|------|--------|-----------|
| POST | `/auth/register` | 无 | `{username, password, nickname?, email?}` | 201；冲突 `409` |
| POST | `/auth/login` | 无 | `{username, password}` | 200 `{token, expiresAt, account:{id,username,nickname,email}}` |
| POST | `/auth/logout` | Bearer | - | 200 `{success:true}`；无 token `401` |
| GET | `/auth/profile` | Bearer | - | 200 账号公开字段；无效/禁用 `401` |

### 10.3 管理员（`/admin`）

| 方法 | 路径 | 认证 | 请求体 | 返回/说明 |
|------|------|------|--------|-----------|
| POST | `/admin/login` | 无 | `{username, password}` | 200 `{token, expiresAt, admin:{id,username,nickname,email,role}}` |
| POST | `/admin/register` | **仅超级管理员** | `{username, password, nickname?, email?, role?, status?}` | 201；角色/状态默认 2/1；冲突 `409`；违反超管约束 `409` |
| POST | `/admin/logout` | Bearer | - | 200 `{success:true}` |
| GET | `/admin/profile` | Bearer | - | 200 公开字段 `{id,username,nickname,email,role,status,lastLoginAt,createdAt}` |
| GET | `/admin` | Bearer | - | 200 管理员列表（公开字段） |
| GET | `/admin/:id` | Bearer | - | 200 详情；不存在 `404 '管理员 ${id} 不存在'` |
| PUT | `/admin/:id` | Bearer | `{nickname?, email?, role?, status?, password?}` | 200 更新后详情；改 role/status 仅超管否则 `403`；违反约束 `409/403`；password 重新 `genSalt(10)`+hash |
| DELETE | `/admin/:id` | **仅超级管理员** | - | 200 `{success:true}`；删最后正常超管 `403` |

### 10.4 业务数据（11 张表通用 CRUD，路由见 §9.5）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/路由` | 仅管理员 token | 新增（`adminId`=当前管理员）；账号 token `403` |
| GET | `/路由` | 管理员或账号 token | 列表（账号只读） |
| GET | `/路由/:id` | 管理员或账号 token | 详情，不存在 `404` |
| PUT | `/路由/:id` | 仅管理员 token | 更新；账号 token `403` |
| DELETE | `/路由/:id` | 仅超级管理员 | 删除；非超管 `403 '仅超级管理员可执行该操作'` |

各表字段与枚举：

- `/weight-files`：`{name, size, hashType, downloadAddress, fileHash, qbit, isSplit?, type?}`；`name` 唯一；`type` 默认0：0=quantized_model，1=mmproj，2=draft_model，3=diffusion_model_text_frames，4=diffusion_model_references，5=prompt_llm，6=audio_vae，7=video-vae。
- `/models`：`{name, type, parameter, contextWindows, hasDraft, hasMmproj, hasDiffusion, creatorId, qorId, launcherId}`；`type`: 1=Image-Text-to-Text，2=Image-Text-to-Video。
- `/mmprojs`、`/draft-models`、`/quantized-models`：`{modelId, weightFileId}`。
- `/diffusion-models`：`{modelId, weightFileId, type}`；`type`: 1=text_frames，2=references，3=llm，4=audio_vae，5=video-vae。
- `/creators`、`/qors`：`{name, countryId}`。
- `/countries`：`{name}`。
- `/launchers`：`{name, icon}`（icon 为 BLOB）。
- `/launcher-versions`：`{platform, osArch, gpu, cuda, name, version, downloadAddress?, extraDownloadAddress?, launcherId}`；`platform`: 1=win32,2=macos,3=linux；`osArch`: 1=x64,2=arm64；`gpu`: 1=NVIDIA,2=AMD,3=INTEL。

### 10.5 定制查询

**`GET /models/paged`**（管理员或账号 token，账号只读）

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `pageSize` | number | 默认 10，最大 100 |
| `id` / `type` / `creatorId` / `qorId` / `launcherId` / `adminId` | number | 精确筛选 |
| `name` | string | 名称模糊匹配 |

返回 `{list, total, page, pageSize, totalPages}`；每条含模型字段 + `creator/qor/launcher/admin` 完整对象 + `mmprojs/draftModels/diffusionModels/quantizedModels`（每项内嵌 `weightFile` 完整对象）；`quantizedModels` 按 qbit 分组、组内 size 升序（见 §9.5）。

**`GET /launcher-versions/filter`**（管理员或账号 token，账号只读）

| 参数 | 说明 |
|------|------|
| `platform` / `osArch` / `gpu` / `cuda` / `launcherId` | 可选，精确筛选，可组合 |

返回数组（无分页，按 `id` 倒序）。

---

## 11. 业务规则（必须实现）

### 11.1 超级管理员唯一正常状态约束

定义：`role === 1 && status === 1` 为「正常状态的超级管理员」。以下三个操作必须满足两条约束：

- **至多一个**：任意时刻不能存在第 2 个正常超管，否则 `409 '已存在状态正常的超级管理员'`。
- **至少一个**：任何时候必须保留至少一个正常超管，否则 `403 '至少需要保留一个状态正常的超级管理员'`。

实现（`AdminAuthService` 私有方法）：

```ts
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
  if ((await this.countNormalSuperAdmins(excludeId)) >= 1)
    throw new ConflictException('已存在状态正常的超级管理员');
}
private async assertOtherNormalSuperAdminExists(excludeId: number) {
  if ((await this.countNormalSuperAdmins(excludeId)) === 0)
    throw new ForbiddenException('至少需要保留一个状态正常的超级管理员');
}
```

触发点：
- **register**：`role===1 && status===1` 时调用 `assertNoOtherNormalSuperAdmin()`（不含 exclude）。
- **update**：
  - 若 `dto.role!==undefined || dto.status!==undefined` 且当前登录者非超管 → `403 '仅超级管理员可修改角色或状态'`。
  - 计算 `newRole`（`dto.role===1?1:2`，缺省取现值）、`newStatus`（非 1/2 时保留现值）。
  - `wasNormalSuper = existing.role===1 && existing.status===1`；`willBeNormalSuper = newRole===1 && newStatus===1`。
  - 若 `willBeNormalSuper && !wasNormalSuper` → `assertNoOtherNormalSuperAdmin(id)`（排除自身）。
  - 若 `wasNormalSuper && !willBeNormalSuper` → `assertOtherNormalSuperAdminExists(id)`。
  - 无效 `role`（非1/2）→ 归一化为 2。
- **remove**：若目标为正常超管 → `assertOtherNormalSuperAdminExists(id)`。

副作用：超级管理员无法自我禁用/降级（自己是唯一正常超管时必然被「至少一个」拦截）。

### 11.2 账号 token 只读

- 业务数据 GET 接口（列表/详情/paged/filter）接受**管理员或账号 token**。
- 业务数据 POST/PUT/DELETE **仅接受管理员 token**；账号 token 一律 `403 '账号 token 仅允许读取（GET）操作'`。
- `/admin/*` 全部仅管理员 token（`AdminAuthGuard`）。
- `/auth/logout` 是**会话管理例外**（账号 token 可删除自身会话）。

### 11.3 会话

- 两类 token 均为 `randomBytes(32).toString('hex')`（64 位 hex），有效期 7 天。
- 登出 = 删除对应 Session/AdminSession 行。

### 11.4 其它

- 所有业务表创建时由服务端写入 `adminId`（当前管理员 id），`createdAt`/`updatedAt` 自动。
- 更新时忽略传入的 `adminId/createdAt/updatedAt`。

---

## 12. 已知实现坑点（重构时务必注意）

1. **Nest 生命周期**：`NestFactory.create()` 在本版本**不触发** `onModuleInit`。`main.ts` 必须先 `await app.init()`，否则内存库不会建表、种子不会执行。
2. **路由顺序**：Express 按注册顺序匹配。`GET /models/paged`、`GET /launcher-versions/filter` 的控制器**必须排在**同前缀 CRUD 控制器之前，否则被 `GET/:id`（ParseIntPipe）拦截返回 `400`。
3. **`prisma migrate dev` 不一定重新生成 client**：新增字段后需显式执行 `npx prisma generate` 再 `nest build`，否则运行时报 "Unknown argument"（但 DB 列已存在）。
4. **Prisma 7 include 类型**：带 `orderBy` 数组的 include 用 `as const` 会报只读数组类型错误；需用 `Prisma.ModelInclude` 显式类型标注。
5. **size 排序**：`weightFile.size` 为字符串（如 `"10.7"`、`"29"`），按数值升序必须 `parseFloat`，解析失败按 `+Infinity`（排最后）。
6. **运行时库 vs CLI 库**：运行时用 `APP_DATABASE_URL`，CLI 用 `DATABASE_URL`；`.env` 中两者都指向 `file:./prisma/dev.db`。
7. **账号 token 方法判断**：`DataAccessGuard` 用 `request.method !== 'GET'` 判定只读；HEAD/OPTIONS 天然放行。
8. **bcryptjs**：当前版本 `genSalt/hash` 产生 `$2b$` 前缀，`compare` 兼容 `$2a$/$2b$`。
9. **SQLite 唯一约束**：`weight_file.name`、`admin.username`、`account.username` 等 `@unique` 冲突会以 500 返回，需业务层先查重并抛 `409`。

---

## 13. 从零重建步骤

1. 初始化 NestJS 项目（nest-cli），安装上述依赖（含 `allowScripts` 允许 better-sqlite3 编译）。
2. 编写 `prisma/schema.prisma`（§5）与 `prisma.config.ts`（§3.2）、`.env`（§3.1）。
3. 运行 `npx prisma migrate dev --name init` 生成迁移（或按 §6 迁移历史逐个创建等价迁移）。
4. 实现 `PrismaService`（§7）、`RedisMockStore`（§9.1）、类型扩展（§8.1）。
5. 实现三个守卫与装饰器（§8.2/§8.3）。
6. 实现账号模块（§9.3）、管理员模块（§9.4 + §11.1）、数据模块（§9.5）。
7. `main.ts` 按 §7 编写，`ensureSuperAdmin` 按 §7 实现。
8. 验证：`npm run build` 通过；启动后按 §10 接口清单逐一验证（重点：管理员登录、账号只读 403、超管约束 409/403、paged 关联与 qbit 分组、filter 筛选）。