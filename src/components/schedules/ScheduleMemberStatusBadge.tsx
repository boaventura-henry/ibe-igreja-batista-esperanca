import { ScheduleMemberStatus } from "@prisma/client";

type ScheduleMemberStatusPresentation = {
  label: string;
  className: string;
};

const statusPresentations: Record<ScheduleMemberStatus, ScheduleMemberStatusPresentation> = {
  PENDING: { label: "Pendente", className: "border-yellow-200 bg-yellow-100 text-yellow-900" },
  CONFIRMED: { label: "Confirmada", className: "border-green-200 bg-green-100 text-green-900" },
  DECLINED: { label: "Recusada", className: "border-red-200 bg-red-100 text-red-900" },
  REPLACED: { label: "Substitu\u00edda", className: "border-gray-200 bg-gray-100 text-gray-800" },
  ABSENT: { label: "Ausente", className: "border-red-200 bg-red-100 text-red-900" }
};

const unknownStatusPresentation: ScheduleMemberStatusPresentation = {
  label: "Status desconhecido",
  className: "border-gray-200 bg-gray-100 text-gray-800"
};

export function getScheduleMemberStatusPresentation(status: ScheduleMemberStatus | string) {
  return statusPresentations[status as ScheduleMemberStatus] ?? unknownStatusPresentation;
}

export function ScheduleMemberStatusBadge({ status }: { status: ScheduleMemberStatus | string }) {
  const presentation = getScheduleMemberStatusPresentation(status);

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold ${presentation.className}`}
      aria-label={`Status da participacao: ${presentation.label}`}
    >
      {presentation.label}
    </span>
  );
}
