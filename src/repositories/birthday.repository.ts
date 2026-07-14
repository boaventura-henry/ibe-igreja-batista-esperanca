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
  nextBirthday: Date;
  today: Date;
  isToday: boolean;
};

export const birthdayRepository = {
  list() {
    return prisma.$queryRaw<BirthdayRecord[]>(Prisma.sql`
      WITH params AS (
        SELECT CURRENT_DATE::date AS today,
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
        SELECT eligible.*, params.today, params.current_year,
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
          ) AS "birthdayThisYear"
        FROM eligible CROSS JOIN params
      ), normalized AS (
        SELECT birthday_dates.*,
          CASE WHEN "birthdayThisYear" < today THEN make_date(
            current_year + 1,
            EXTRACT(MONTH FROM "birthDate")::int,
            CASE
              WHEN EXTRACT(MONTH FROM "birthDate") = 2
                AND EXTRACT(DAY FROM "birthDate") = 29
                AND NOT (
                  (current_year + 1) % 4 = 0
                  AND ((current_year + 1) % 100 <> 0 OR (current_year + 1) % 400 = 0)
                ) THEN 28
              ELSE EXTRACT(DAY FROM "birthDate")::int
            END
          ) ELSE "birthdayThisYear" END AS "nextBirthday"
        FROM birthday_dates
      )
      SELECT id, name, "photoUrl", "ministryId", "ministryName", "ministryColor",
        "birthdayThisYear", "nextBirthday", today,
        ("nextBirthday" = today) AS "isToday"
      FROM normalized
      WHERE (
        "birthdayThisYear" >= date_trunc('month', today)::date
        AND "birthdayThisYear" < (date_trunc('month', today) + INTERVAL '1 month')::date
      ) OR (
        "nextBirthday" > today
        AND "nextBirthday" <= (today + INTERVAL '7 days')::date
      )
      ORDER BY "nextBirthday" ASC, name ASC
    `);
  }
};
