import { birthdayRepository, type BirthdayRecord } from "@/repositories";
import type { BirthdayDashboardData, BirthdayPerson } from "@/types";

function serialize(record: BirthdayRecord): BirthdayPerson {
  return {
    id: record.id,
    name: record.name,
    photoUrl: record.photoUrl,
    ministry: record.ministryId && record.ministryName && record.ministryColor
      ? { id: record.ministryId, name: record.ministryName, color: record.ministryColor }
      : null,
    birthdayDate: record.nextBirthday.toISOString(),
    birthdayMonth: record.nextBirthday.getUTCMonth() + 1,
    birthdayDay: record.nextBirthday.getUTCDate(),
    isToday: record.isToday
  };
}

export const birthdayService = {
  async getDashboard(): Promise<BirthdayDashboardData> {
    const records = await birthdayRepository.list();
    const monthRecords = records
      .filter((record) => record.birthdayThisYear.getUTCMonth() === record.today.getUTCMonth())
      .sort((left, right) => {
        const dayDifference = left.birthdayThisYear.getUTCDate() - right.birthdayThisYear.getUTCDate();
        return dayDifference || left.name.localeCompare(right.name, "pt-BR");
      });
    const today = records
      .filter((record) => record.isToday)
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
      .map(serialize);
    const upcoming = records
      .filter((record) => !record.isToday && record.nextBirthday > record.today)
      .sort((left, right) => left.nextBirthday.getTime() - right.nextBirthday.getTime() || left.name.localeCompare(right.name, "pt-BR"))
      .map(serialize);
    const month = monthRecords.map(serialize);
    const monthDate = records[0]?.today ?? new Date();

    return {
      today,
      upcoming,
      month,
      monthLabel: new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(monthDate),
      monthCount: month.length
    };
  }
};
