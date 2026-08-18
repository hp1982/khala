# Khala API 接口文档

> 本文件由项目接口变更时同步维护。接口有增删改时，请在此更新。

**基础信息**
- 服务端口：`3000`（`PORT` 环境变量可改）
- 默认启动自动创建超级管理员：`admin / admin123`（可用 `ADMIN_INIT_USERNAME` / `ADMIN_INIT_PASSWORD` 覆盖）
- 认证方式：`Authorization: Bearer <token>`
- 两类 token：**管理员 token**（`/admin/login`，可读写数据与管理员管理）；**账号 token**（`/auth/login`，**只读**，仅可用于 GET 接口）
- 业务数据接口：`GET` 接口接受管理员或账号 token；`POST/PUT/DELETE` 仅接受管理员 token，账号 token 一律返回 `403`
- 业务数据 `DELETE` 接口仅超级管理员（`role=1`）可执行，否则返回 `403`

---

## 一、系统（`GET /`）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 无 | 健康检查，返回 `"Hello World!"` |

---

## 二、账号（`/auth`，Account 体系，独立于管理员）

| 方法 | 路径 | 认证 | 请求体 | 说明 |
|------|------|------|--------|------|
| POST | `/auth/register` | 无 | `{username, password, nickname?, email?}` | 注册，用户名/邮箱冲突返回 409 |
| POST | `/auth/login` | 无 | `{username, password}` | 登录，返回 `{token, expiresAt, account}` |
| POST | `/auth/logout` | Bearer | - | 删除服务端会话，返回 `{success:true}` |
| GET | `/auth/profile` | Bearer | - | 当前账号公开信息 |

> 账号 token 为**只读**：只能访问 GET 接口（`/auth/profile` 及业务数据 GET），不允许修改或删除数据；访问数据 POST/PUT/DELETE 接口返回 `403`。登出 `POST /auth/logout` 为会话管理例外，仅删除自身会话。会话随登录 7 天自动过期。

---

## 三、管理员（`/admin`）

| 方法 | 路径 | 认证 | 请求体 | 说明 |
|------|------|------|--------|------|
| POST | `/admin/login` | 无 | `{username, password}` | 登录，返回 `{token, expiresAt, admin}` |
| POST | `/admin/register` | **仅超级管理员** | `{username, password, nickname?, email?, role?, status?}` | 新建管理员（`role`: 1=超级 2=普通，默认2；`status`: 1=正常 2=禁用，默认1） |
| POST | `/admin/logout` | Bearer | - | 登出，删除会话 |
| GET | `/admin/profile` | Bearer | - | 当前管理员信息 |
| GET | `/admin` | Bearer | - | 管理员列表 |
| GET | `/admin/:id` | Bearer | - | 管理员详情 |
| PUT | `/admin/:id` | Bearer | `{nickname?, email?, role?, status?, password?}` | 更新；**改角色/状态仅超级管理员**，password 自动重新加盐 |
| DELETE | `/admin/:id` | **仅超级管理员** | - | 删除管理员（连同其会话） |

**admin 公开字段**：`id, username, nickname, email, role, status, lastLoginAt, createdAt`

**超级管理员状态约束**（`role=1`）：
- 任意时刻**至多一个**超级管理员为正常状态（`status=1`），否则创建/启用/晋升返回 `409`
- 任意时刻**至少保留一个**正常状态的超级管理员，禁用（`status 1→2`）、降级（`role 1→2`）或删除最后一个正常超级管理员时返回 `403`
- 新建超级管理员可指定 `status=2`（禁用）以绕过「仅一个正常」限制，但该账号无法登录

---

## 四、业务数据表 CRUD（11 张）

通用规则（每张表均支持以下 5 个操作，`adminId`/`createdAt`/`updatedAt` 由服务端自动写入，创建/更新时无需传）：

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/路由` | **仅管理员 token** | 新增（`adminId`=当前管理员），账号 token 返回 403 |
| GET | `/路由` | 管理员或账号 token | 列表（账号 token 只读） |
| GET | `/路由/:id` | 管理员或账号 token | 详情（账号 token 只读），不存在返回 404 |
| PUT | `/路由/:id` | **仅管理员 token** | 更新，账号 token 返回 403 |
| DELETE | `/路由/:id` | **仅超级管理员** | 删除 |

### 4.1 `/weight-files`（权重文件）
`{name, size, hashType, downloadAddress, fileHash, qbit, isSplit?, type?}` — `name` 唯一，`isSplit` 默认 `false`（是否已拆分）
- `type` 默认 `0`：0=quantized_model，1=mmproj，2=draft_model，3=diffusion_model_text_frames，4=diffusion_model_references，5=prompt_llm，6=audio_vae，7=video-vae

### 4.2 `/models`（模型）
`{name, type, parameter, contextWindows, hasDraft, hasMmproj, hasDiffusion, creatorId, qorId, launcherId}`
- `type`: 1=Image-Text-to-Text，2=Image-Text-to-Video
- `creatorId/qorId/launcherId` 为外键，须指向已存在记录

**分页查询：`GET /models/paged`**（管理员或账号 token，账号只读）
| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码，默认 1 |
| `pageSize` | number | 每页条数，默认 10，最大 100 |
| `id` / `type` / `creatorId` / `qorId` / `launcherId` / `adminId` | number | 精确筛选 |
| `name` | string | 名称模糊匹配 |

返回 `{list, total, page, pageSize, totalPages}`，每条 `list` 项包含：
- 模型自身字段
- `creator`、`qor`、`launcher`、`admin`（外键完整对象）
- `mmprojs`、`draftModels`、`diffusionModels`、`quantizedModels` 数组，每项内嵌对应 `weightFile` 完整对象
- `quantizedModels` 按 `weightFile.qbit` 分组（qbit 升序，无 qbit 的排最后），组内按 `weightFile.size` 数值升序排列

### 4.3 `/mmprojs`
`{modelId, weightFileId}`

### 4.4 `/draft-models`
`{modelId, weightFileId}`

### 4.5 `/diffusion-models`
`{modelId, weightFileId, type}`
- `type`: 1=text_frames，2=references，3=llm，4=audio_vae，5=video-vae

### 4.6 `/quantized-models`
`{modelId, weightFileId}`

### 4.7 `/creators`（创作者）
`{name, countryId}`

### 4.8 `/qors`
`{name, countryId}`

### 4.9 `/countries`（国家/地区）
`{name}`

### 4.10 `/launchers`
`{name, icon}` — `icon` 为二进制(BLOB)

### 4.11 `/launcher-versions`
`{platform, osArch, gpu, cuda, name, version, launcherId}`
- `platform`: 1=win32，2=macos，3=linux
- `osArch`: 1=x64，2=arm64
- `gpu`: 1=NVIDIA，2=AMD，3=INTEL
- `launcherId` 必填外键

---

## 五、调用示例

```bash
# 1. 超级管理员登录
curl -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# => {"token":"...","expiresAt":"...","admin":{...}}

# 2. 创建模型（携带 token）
curl -X POST http://localhost:3000/models \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Qwen2-VL-7B","type":1,"parameter":"7B"}'

# 3. 普通管理员删除 -> 403
curl -X DELETE http://localhost:3000/models/1 \
  -H "Authorization: Bearer <普通管理员token>"
# => 403 {"statusCode":403,"message":"仅超级管理员可执行该操作"}

# 4. 超级管理员删除
curl -X DELETE http://localhost:3000/models/1 \
  -H "Authorization: Bearer <超级管理员token>"
```

**常见错误码**：`400` 参数非法（非数字 id）、`401` 未登录/token 失效、`403` 非超级管理员删操作、`404` 记录不存在、`409` 注册冲突/唯一约束冲突、`500` 外键约束等服务端错误。
