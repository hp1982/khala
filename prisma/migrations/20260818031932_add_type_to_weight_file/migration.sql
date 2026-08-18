-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_weight_file" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "size" TEXT,
    "hashType" INTEGER,
    "downloadAddress" TEXT,
    "fileHash" TEXT,
    "qbit" INTEGER,
    "isSplit" BOOLEAN NOT NULL DEFAULT false,
    "type" INTEGER NOT NULL DEFAULT 0,
    "adminId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "weight_file_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_weight_file" ("adminId", "createdAt", "downloadAddress", "fileHash", "hashType", "id", "isSplit", "name", "qbit", "size", "updatedAt") SELECT "adminId", "createdAt", "downloadAddress", "fileHash", "hashType", "id", "isSplit", "name", "qbit", "size", "updatedAt" FROM "weight_file";
DROP TABLE "weight_file";
ALTER TABLE "new_weight_file" RENAME TO "weight_file";
CREATE UNIQUE INDEX "weight_file_name_key" ON "weight_file"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
