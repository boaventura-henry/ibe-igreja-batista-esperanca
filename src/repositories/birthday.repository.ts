import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";

export type BirthdayRecord = {
  id: string;
  name: string;
  photoUrl: string | null;
  ministryId: string | null;
  ministryName: string | null;
  ministryColor: string | null;
  birthdayThisYear: Date;
  weeklyBirthday: Date;
  today: Date;
  isToday: boolean;
  isWeekly: boolean;
};

export const birthdayRepository = {
  list() {
    return prisma.$queryRaw<BirthdayRecord[]>(Prisma.sql`
      WITH params AS (
        SELECT CURRENT_DATE::date AS today,
          date_trunc('week', CURRENT_DATE)::date AS week_start,
          (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date AS week_end,
          EXTRACT(YEAR FROM CURRENT_DATE)::int AS current_year
      ), eligible AS (
        SELECT m.id, m.name, m."photoUrl" AS "photoUrl",
          principal.id AS "ministryId",
          principal.name AS "ministryName",
          principal.color AS "ministryColor",
          m."birthDate" AS "birthDate"
        FROM "Member" m
        LEFT JOIN LATERAL (
          SELECT ministry.id, ministry.name, ministry.color
          FROM "MemberMinistry" member_ministry
          INNER JOIN "Ministry" ministry ON ministry.id = member_ministry."ministryId"
          WHERE member_ministry."memberId" = m.id
            AND member_ministry.status = 'ACTIVE'
            AND member_ministry."deletedAt" IS NULL
            AND ministry."isActive" = true
            AND ministry."deletedAt" IS NULL
          ORDER BY CASE member_ministry.role
            WHEN 'LEADER' THEN 0
            WHEN 'VICE_LEADER' THEN 1
            ELSE 2
          END, ministry."displayOrder" ASC, ministry.name ASC
          LIMIT 1
        ) principal ON true
        WHERE m.status = 'ACTIVE'
          AND m."deletedAt" IS NULL
          AND m."birthDate" IS NOT NULL
      ), birthday_dates AS (
        SELECT eligible.*, params.today, params.week_start, params.week_end, params.current_year,
          make_date(
            params.current_year,
            EXTRACT(MONTH FROM eligible."birthDate")::int,
            CASE
              WHEN EXTRACT(MONTH FROM eligible."birthDate") = 2
                AND EXTRACT(DAY FROM eligible."birthDate") = 29
                AND NOT (
                  params.current_year % 4 = 0
                  AND (params.current_year % 100 <> 0 OR params.current_year % 400 = 0)
                ) THEN 28
              ELSE EXTRACT(DAY FROM eligible."birthDate")::int
            END
          ) AS "birthdayThisYear",
          make_date(
            params.current_year + 1,
            EXTRACT(MONTH FROM eligible."birthDate")::int,
            CASE
              WHEN EXTRACT(MONTH FROM eligible."birthDate") = 2
                AND EXTRACT(DAY FROM eligible."birthDate") = 29
                AND NOT (
                  (params.current_year + 1) % 4 = 0
                  AND ((params.current_year + 1) % 100 <> 0 OR (params.current_year + 1) % 400 = 0)
                ) THEN 28
              ELSE EXTRACT(DAY FROM eligible."birthDate")::int
            END
          ) AS "birthdayNextYear"
        FROM eligible CROSS JOIN params
      ), selected AS (
        SELECT birthday_dates.*,
          CASE
            WHEN "birthdayThisYear" BETWEEN week_start AND week_end THEN "birthdayThisYear"
            WHEN "birthdayNextYear" BETWEEN week_start AND week_end THEN "birthdayNextYear"
            ELSE "birthdayThisYear"
          END AS "weeklyBirthday",
          ("birthdayThisYear" BETWEEN week_start AND week_end
            OR "birthdayNextYear" BETWEEN week_start AND week_end) AS "isWeekly"
        FROM birthday_dates
        WHERE (
          "birthdayThisYear" >= date_trunc('month', today)::date
          AND "birthdayThisYear" < (date_trunc('month', today) + INTERVAL '1 month')::date
        ) OR "birthdayThisYear" BETWEEN week_start AND week_end
          OR "birthdayNextYear" BETWEEN week_start AND week_end
      )
      SELECT id, name, "photoUrl", "ministryId", "ministryName", "ministryColor",
        "birthdayThisYear", "weeklyBirthday", today, "isWeekly",
        ("birthdayThisYear" = today) AS "isToday"
      FROM selected
      ORDER BY "weeklyBirthday" ASC, name ASC
    `);
  }
};
