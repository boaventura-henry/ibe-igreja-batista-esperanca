import { ScheduleScope } from "@prisma/client";
import { scheduleAccessRepository } from "@/repositories";
import type { ScheduleAccessContext, ScheduleAccessUser } from "@/types";

type ScheduleAccessDependencies = {
  listActiveMinistryIds(memberId: string): Promise<string[]>;
};

function immutableContext(
  scope: ScheduleScope,
  memberId: string | null,
  authorizedMinistryIds: readonly string[] | null
): ScheduleAccessContext {
  return Object.freeze({
    scope,
    memberId,
    authorizedMinistryIds: authorizedMinistryIds ? Object.freeze([...authorizedMinistryIds]) : null
  });
}

export async function resolveScheduleAccessContext(
  currentUser: ScheduleAccessUser,
  dependencies: ScheduleAccessDependencies = scheduleAccessRepository
): Promise<ScheduleAccessContext> {
  const scope = currentUser.scheduleScope ?? ScheduleScope.MEMBER_MINISTRIES;
  const memberId = currentUser.memberId ?? null;

  if (scope === ScheduleScope.ALL) {
    return immutableContext(scope, memberId, null);
  }

  if (!memberId) {
    return immutableContext(ScheduleScope.MEMBER_MINISTRIES, null, []);
  }

  const ministryIds = await dependencies.listActiveMinistryIds(memberId);

  return immutableContext(ScheduleScope.MEMBER_MINISTRIES, memberId, [...new Set(ministryIds)]);
}
