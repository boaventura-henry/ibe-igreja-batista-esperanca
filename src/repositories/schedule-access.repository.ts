import { MemberMinistryStatus, Prisma, ScheduleScope } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { ScheduleAccessContext } from "@/types";

export function buildActiveMemberMinistryWhere(memberId: string): Prisma.MemberMinistryWhereInput {
  return {
    memberId,
    status: MemberMinistryStatus.ACTIVE,
    exitDate: null,
    deletedAt: null
  };
}

export function buildScheduleScopeWhere(accessContext: ScheduleAccessContext): Prisma.ScheduleWhereInput {
  if (accessContext.scope === ScheduleScope.ALL) {
    return {};
  }

  return {
    ministryId: {
      in: [...(accessContext.authorizedMinistryIds ?? [])]
    }
  };
}

export const scheduleAccessRepository = {
  async listActiveMinistryIds(memberId: string) {
    const links = await prisma.memberMinistry.findMany({
      where: buildActiveMemberMinistryWhere(memberId),
      select: { ministryId: true },
      distinct: ["ministryId"],
      orderBy: { ministryId: "asc" }
    });

    return links.map((link) => link.ministryId);
  }
};
