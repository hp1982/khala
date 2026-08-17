/*
  Warnings:

  - You are about to drop the column `isSplit` on the `quantized_model` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_quantized_model" (
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
INSERT INTO "new_quantized_model" ("adminId", "createdAt", "id", "modelId", "updatedAt", "weightFileId") SELECT "adminId", "createdAt", "id", "modelId", "updatedAt", "weightFileId" FROM "quantized_model";
DROP TABLE "quantized_model";
ALTER TABLE "new_quantized_model" RENAME TO "quantized_model";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
