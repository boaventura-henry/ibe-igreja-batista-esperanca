import {
  scheduleMemberCountLabel,
  summarizeScheduleMembers,
  type ScheduleListMemberName
} from "@/lib/schedule-member-summary";

type ScheduleMemberNamesProps = {
  members: readonly ScheduleListMemberName[];
  memberCount: number;
};

function MemberSummary({ members, limit }: { members: readonly ScheduleListMemberName[]; limit: number }) {
  const summary = summarizeScheduleMembers(members, limit);

  return (
    <div className="space-y-1">
      <p className="whitespace-normal break-words text-sm font-semibold text-ink-800">
        {summary.names.join(", ")}
      </p>
      {summary.remainingLabel ? (
        <p className="text-xs font-bold text-hope-700">{summary.remainingLabel}</p>
      ) : null}
    </div>
  );
}

export function ScheduleMemberNames({ members, memberCount }: ScheduleMemberNamesProps) {
  if (memberCount === 0) {
    return <span className="font-semibold text-ink-500">Nenhum membro</span>;
  }

  return (
    <div className="min-w-44 max-w-xs">
      <p className="mb-1 text-xs font-bold text-ink-500">Membros ({memberCount})</p>
      <div className="sm:hidden">
        <MemberSummary members={members} limit={3} />
      </div>
      <div className="hidden sm:block">
        <MemberSummary members={members} limit={5} />
      </div>
      <span className="sr-only">{scheduleMemberCountLabel(memberCount)}</span>
    </div>
  );
}
