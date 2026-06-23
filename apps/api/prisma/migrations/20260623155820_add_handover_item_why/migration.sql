-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HandoverItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handoverId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "issueId" TEXT,
    "reconcileTag" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "why" TEXT NOT NULL DEFAULT '',
    "sourceRefs" TEXT NOT NULL DEFAULT '[]',
    "flags" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "HandoverItem_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HandoverItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HandoverItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HandoverItem" ("bucket", "flags", "handoverId", "hotelId", "id", "issueId", "reconcileTag", "sourceRefs", "text") SELECT "bucket", "flags", "handoverId", "hotelId", "id", "issueId", "reconcileTag", "sourceRefs", "text" FROM "HandoverItem";
DROP TABLE "HandoverItem";
ALTER TABLE "new_HandoverItem" RENAME TO "HandoverItem";
CREATE INDEX "HandoverItem_handoverId_idx" ON "HandoverItem"("handoverId");
CREATE INDEX "HandoverItem_hotelId_idx" ON "HandoverItem"("hotelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
