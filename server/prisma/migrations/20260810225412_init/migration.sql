-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LINK', 'UPLOAD');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('SERVE', 'ACE', 'SPIKE', 'BLOCK', 'DIG', 'SET', 'ASSIST');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('POINT_WON', 'POINT_LOST', 'NO_POINT');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "graduationYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "opponent" TEXT,
    "matchDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistClip" (
    "playlistId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PlaylistClip_pkey" PRIMARY KEY ("playlistId","clipId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_shareToken_key" ON "Playlist"("shareToken");

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistClip" ADD CONSTRAINT "PlaylistClip_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistClip" ADD CONSTRAINT "PlaylistClip_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
