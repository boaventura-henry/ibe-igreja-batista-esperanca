import { ScheduleMemberStatus } from "@prisma/client";

export const scheduleMemberStatusLabels: Record<ScheduleMemberStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  DECLINED: "Recusada",
  REPLACED: "Substituida",
  ABSENT: "Ausente"
};

const statusClasses: Record<ScheduleMemberStatus, string> = {
  PENDING: "border-yellow-200 bg-yellow-100 text-yellow-900",
  CONFIRMED: "border-green-200 bg-green-100 text-green-900",
  DECLINED: "border-red-200 bg-red-100 text-red-900",
  REPLACED: "border-gray-200 bg-gray-100 text-gray-800",
  ABSENT: "border-red-200 bg-red-100 text-red-900"
};

export function ScheduleMemberStatusBadge({ status }: { status: ScheduleMemberStatus }) {
  const label = scheduleMemberStatusLabels[status];

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}
      aria-label={`Status da participacao: ${label}`}
    >
      {label}
    </span>
  );
}
