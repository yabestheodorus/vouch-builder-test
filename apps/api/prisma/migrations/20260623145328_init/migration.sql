-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rooms" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "nightOf" DATETIME NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RawLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NormalizedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "rawLogId" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "occurredAt" DATETIME,
    "room" TEXT,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rawStatus" TEXT,
    "flags" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "NormalizedEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NormalizedEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NormalizedEvent_rawLogId_fkey" FOREIGN KEY ("rawLogId") REFERENCES "RawLog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "room" TEXT,
    "firstSeenShiftId" TEXT NOT NULL,
    "lastSeenShiftId" TEXT NOT NULL,
    "resolvedShiftId" TEXT,
    "sourceRefs" TEXT NOT NULL DEFAULT '[]',
    "flags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Issue_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Issue_firstSeenShiftId_fkey" FOREIGN KEY ("firstSeenShiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Issue_lastSeenShiftId_fkey" FOREIGN KEY ("lastSeenShiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Issue_resolvedShiftId_fkey" FOREIGN KEY ("resolvedShiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "summary" TEXT,
    CONSTRAINT "Handover_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Handover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandoverItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handoverId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "issueId" TEXT,
    "reconcileTag" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceRefs" TEXT NOT NULL DEFAULT '[]',
    "flags" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "HandoverItem_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HandoverItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HandoverItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "shiftId" TEXT,
    "handoverId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputCounts" TEXT NOT NULL DEFAULT '{}',
    "reasoning" TEXT NOT NULL,
    "flags" TEXT NOT NULL DEFAULT '[]',
    "tokenUsage" TEXT,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    CONSTRAINT "GenerationLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GenerationLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GenerationLog_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Shift_hotelId_idx" ON "Shift"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_hotelId_nightOf_key" ON "Shift"("hotelId", "nightOf");

-- CreateIndex
CREATE INDEX "RawLog_hotelId_shiftId_idx" ON "RawLog"("hotelId", "shiftId");

-- CreateIndex
CREATE INDEX "NormalizedEvent_hotelId_shiftId_idx" ON "NormalizedEvent"("hotelId", "shiftId");

-- CreateIndex
CREATE INDEX "Issue_hotelId_status_idx" ON "Issue"("hotelId", "status");

-- CreateIndex
CREATE INDEX "Handover_hotelId_generatedAt_idx" ON "Handover"("hotelId", "generatedAt");

-- CreateIndex
CREATE INDEX "HandoverItem_handoverId_idx" ON "HandoverItem"("handoverId");

-- CreateIndex
CREATE INDEX "HandoverItem_hotelId_idx" ON "HandoverItem"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationLog_handoverId_key" ON "GenerationLog"("handoverId");

-- CreateIndex
CREATE INDEX "GenerationLog_hotelId_startedAt_idx" ON "GenerationLog"("hotelId", "startedAt");
