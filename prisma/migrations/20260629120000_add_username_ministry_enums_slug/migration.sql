-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WeekDay" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MinistryIcon" AS ENUM ('MUSIC', 'CHILDREN', 'CAMERA', 'USERS', 'HEART', 'CROSS', 'BOOK', 'CHURCH', 'MIC', 'HOME');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add nullable columns first so existing data can be migrated safely.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill unique usernames from existing names/emails.
DO $$
DECLARE
  user_record RECORD;
  base_username TEXT;
  candidate_username TEXT;
  suffix INTEGER;
BEGIN
  FOR user_record IN SELECT "id", "name", "email" FROM "User" WHERE "username" IS NULL OR "username" = '' ORDER BY "createdAt", "id" LOOP
    base_username := regexp_replace(upper(coalesce(nullif(user_record."name", ''), split_part(user_record."email", '@', 1), 'USER')), '[^A-Z0-9_.]', '', 'g');

    IF length(base_username) < 4 THEN
      base_username := 'USER';
    END IF;

    base_username := left(base_username, 30);
    candidate_username := base_username;
    suffix := 1;

    WHILE EXISTS (
      SELECT 1 FROM "User"
      WHERE "username" = candidate_username AND "id" <> user_record."id"
    ) LOOP
      candidate_username := left(base_username, greatest(1, 30 - length(suffix::TEXT))) || suffix::TEXT;
      suffix := suffix + 1;
    END LOOP;

    UPDATE "User" SET "username" = candidate_username WHERE "id" = user_record."id";
  END LOOP;
END $$;

-- Backfill unique slugs from ministry names, including common Portuguese accents.
DO $$
DECLARE
  ministry_record RECORD;
  normalized_name TEXT;
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INTEGER;
BEGIN
  FOR ministry_record IN SELECT "id", "name" FROM "Ministry" WHERE "slug" IS NULL OR "slug" = '' ORDER BY "displayOrder", "createdAt", "id" LOOP
    normalized_name := lower(translate(
      ministry_record."name",
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ));
    base_slug := regexp_replace(normalized_name, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '(^-|-$)', '', 'g');

    IF length(base_slug) = 0 THEN
      base_slug := 'ministerio';
    END IF;

    candidate_slug := base_slug;
    suffix := 1;

    WHILE EXISTS (
      SELECT 1 FROM "Ministry"
      WHERE "slug" = candidate_slug AND "id" <> ministry_record."id"
    ) LOOP
      candidate_slug := base_slug || '-' || suffix::TEXT;
      suffix := suffix + 1;
    END LOOP;

    UPDATE "Ministry" SET "slug" = candidate_slug WHERE "id" = ministry_record."id";
  END LOOP;
END $$;

-- Convert Ministry.icon from text to enum preserving known previous values.
ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "icon_new" "MinistryIcon" NOT NULL DEFAULT 'USERS';

UPDATE "Ministry"
SET "icon_new" = CASE upper(coalesce("icon"::TEXT, 'USERS'))
  WHEN 'MUSIC' THEN 'MUSIC'::"MinistryIcon"
  WHEN 'CHILDREN' THEN 'CHILDREN'::"MinistryIcon"
  WHEN 'BABY' THEN 'CHILDREN'::"MinistryIcon"
  WHEN 'CAMERA' THEN 'CAMERA'::"MinistryIcon"
  WHEN 'USERS' THEN 'USERS'::"MinistryIcon"
  WHEN 'SPARKLES' THEN 'USERS'::"MinistryIcon"
  WHEN 'HEART' THEN 'HEART'::"MinistryIcon"
  WHEN 'CROSS' THEN 'CROSS'::"MinistryIcon"
  WHEN 'PRAYING-HANDS' THEN 'CROSS'::"MinistryIcon"
  WHEN 'BOOK' THEN 'BOOK'::"MinistryIcon"
  WHEN 'CHURCH' THEN 'CHURCH'::"MinistryIcon"
  WHEN 'HANDSHAKE' THEN 'CHURCH'::"MinistryIcon"
  WHEN 'MIC' THEN 'MIC'::"MinistryIcon"
  WHEN 'HOME' THEN 'HOME'::"MinistryIcon"
  WHEN 'BUILDING' THEN 'HOME'::"MinistryIcon"
  ELSE 'USERS'::"MinistryIcon"
END;

ALTER TABLE "Ministry" DROP COLUMN IF EXISTS "icon";
ALTER TABLE "Ministry" RENAME COLUMN "icon_new" TO "icon";

-- Convert Ministry.meetingDay from text to enum preserving known values.
ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "meetingDay_new" "WeekDay";

UPDATE "Ministry"
SET "meetingDay_new" = CASE upper(coalesce("meetingDay"::TEXT, ''))
  WHEN 'SUNDAY' THEN 'SUNDAY'::"WeekDay"
  WHEN 'DOMINGO' THEN 'SUNDAY'::"WeekDay"
  WHEN 'MONDAY' THEN 'MONDAY'::"WeekDay"
  WHEN 'SEGUNDA-FEIRA' THEN 'MONDAY'::"WeekDay"
  WHEN 'TUESDAY' THEN 'TUESDAY'::"WeekDay"
  WHEN 'TERCA-FEIRA' THEN 'TUESDAY'::"WeekDay"
  WHEN 'TERÇA-FEIRA' THEN 'TUESDAY'::"WeekDay"
  WHEN 'WEDNESDAY' THEN 'WEDNESDAY'::"WeekDay"
  WHEN 'QUARTA-FEIRA' THEN 'WEDNESDAY'::"WeekDay"
  WHEN 'THURSDAY' THEN 'THURSDAY'::"WeekDay"
  WHEN 'QUINTA-FEIRA' THEN 'THURSDAY'::"WeekDay"
  WHEN 'FRIDAY' THEN 'FRIDAY'::"WeekDay"
  WHEN 'SEXTA-FEIRA' THEN 'FRIDAY'::"WeekDay"
  WHEN 'SATURDAY' THEN 'SATURDAY'::"WeekDay"
  WHEN 'SABADO' THEN 'SATURDAY'::"WeekDay"
  WHEN 'SÁBADO' THEN 'SATURDAY'::"WeekDay"
  ELSE NULL
END;

ALTER TABLE "Ministry" DROP COLUMN IF EXISTS "meetingDay";
ALTER TABLE "Ministry" RENAME COLUMN "meetingDay_new" TO "meetingDay";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "Ministry" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "Ministry_slug_key" ON "Ministry"("slug");
