import type { ScheduleScope } from "@prisma/client";

export type ScheduleAccessContext = Readonly<{
  scope: ScheduleScope;
  memberId: string | null;
  authorizedMinistryIds: readonly string[] | null;
}>;

export type ScheduleAccessUser = Readonly<{
  memberId?: string | null;
  scheduleScope?: ScheduleScope | null;
}>;
