-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "youtubeUrl" TEXT,
    "referenceKey" TEXT,
    "resourceUrl" TEXT,
    "simplifiedResourceUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSong" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "referenceKey" TEXT,
    "performanceKey" TEXT,
    "leadMemberId" TEXT,
    "youtubeUrlOverride" TEXT,
    "resourceUrlOverride" TEXT,
    "useSimplifiedVersion" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Song_title_idx" ON "Song"("title");

-- CreateIndex
CREATE INDEX "Song_artist_idx" ON "Song"("artist");

-- CreateIndex
CREATE INDEX "Song_isActive_idx" ON "Song"("isActive");

-- CreateIndex
CREATE INDEX "Song_deletedAt_idx" ON "Song"("deletedAt");

-- CreateIndex
CREATE INDEX "ScheduleSong_scheduleId_position_deletedAt_idx" ON "ScheduleSong"("scheduleId", "position", "deletedAt");

-- CreateIndex
CREATE INDEX "ScheduleSong_songId_idx" ON "ScheduleSong"("songId");

-- CreateIndex
CREATE INDEX "ScheduleSong_leadMemberId_idx" ON "ScheduleSong"("leadMemberId");

-- CreateIndex
CREATE INDEX "ScheduleSong_deletedAt_idx" ON "ScheduleSong"("deletedAt");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_leadMemberId_fkey" FOREIGN KEY ("leadMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSong" ADD CONSTRAINT "ScheduleSong_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
