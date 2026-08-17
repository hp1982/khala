-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "nickname" TEXT,
    "email" TEXT,
    "role" INTEGER NOT NULL DEFAULT 2,
    "status" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "weight_file" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "size" TEXT,
    "hashType" INTEGER,
    "downloadAddress" TEXT,
    "fileHash" TEXT,
    "qbit" INTEGER,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "weight_file_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "type" INTEGER,
    "parameter" TEXT,
    "contextWindows" INTEGER,
    "hasDraft" INTEGER,
    "hasMmproj" INTEGER,
    "hasDiffusion" INTEGER NOT NULL DEFAULT 0,
    "creatorId" INTEGER,
    "qorId" INTEGER,
    "launcherId" INTEGER,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "model_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creator" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "model_qorId_fkey" FOREIGN KEY ("qorId") REFERENCES "qor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "model_launcherId_fkey" FOREIGN KEY ("launcherId") REFERENCES "launcher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "model_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mmproj" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "weightFileId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mmproj_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mmproj_weightFileId_fkey" FOREIGN KEY ("weightFileId") REFERENCES "weight_file" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "mmproj_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "draft_model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "weightFileId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "draft_model_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "draft_model_weightFileId_fkey" FOREIGN KEY ("weightFileId") REFERENCES "weight_file" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "draft_model_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diffusion_model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "weightFileId" INTEGER NOT NULL,
    "type" INTEGER,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "diffusion_model_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "diffusion_model_weightFileId_fkey" FOREIGN KEY ("weightFileId") REFERENCES "weight_file" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "diffusion_model_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quantized_model" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "weightFileId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "quantized_model_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quantized_model_weightFileId_fkey" FOREIGN KEY ("weightFileId") REFERENCES "weight_file" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quantized_model_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "creator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "countryId" INTEGER,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "creator_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "creator_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "qor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "countryId" INTEGER,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "qor_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "country" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "qor_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "country" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "country_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "launcher" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "icon" BLOB,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "launcher_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "launcher_version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "platform" INTEGER,
    "osArch" INTEGER,
    "gpu" INTEGER,
    "cuda" INTEGER,
    "name" TEXT,
    "version" TEXT,
    "launcherId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "launcher_version_launcherId_fkey" FOREIGN KEY ("launcherId") REFERENCES "launcher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "launcher_version_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "weight_file_name_key" ON "weight_file"("name");
