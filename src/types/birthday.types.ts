export type BirthdayPerson = {
  id: string;
  name: string;
  photoUrl: string | null;
  ministry: {
    id: string;
    name: string;
    color: string;
  } | null;
  birthdayDate: string;
  birthdayMonth: number;
  birthdayDay: number;
  isToday: boolean;
};

export type BirthdayDashboardData = {
  today: BirthdayPerson[];
  weekly: BirthdayPerson[];
  month: BirthdayPerson[];
  monthLabel: string;
  monthCount: number;
};
