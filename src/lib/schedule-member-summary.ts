export type ScheduleListMemberName = {
  id: string;
  member: {
    id: string;
    name: string;
    displayName: string;
  };
};

export function scheduleMemberCountLabel(count: number) {
  if (count === 0) return "Nenhum membro";
  return `${count} ${count === 1 ? "membro" : "membros"}`;
}

export function scheduleRemainingMembersLabel(count: number) {
  return `+${count} ${count === 1 ? "membro" : "membros"}`;
}

export function summarizeScheduleMembers(
  members: readonly ScheduleListMemberName[],
  limit: number
) {
  const visible = members.slice(0, Math.max(0, limit));
  const remaining = Math.max(0, members.length - visible.length);

  return {
    names: visible.map((participant) => participant.member.displayName),
    remaining,
    remainingLabel: remaining ? scheduleRemainingMembersLabel(remaining) : null
  };
}
