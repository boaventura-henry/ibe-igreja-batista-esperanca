import { ScheduleMemberRole } from "@prisma/client";

type ScheduleMemberRolePresentation = {
  value: ScheduleMemberRole | null;
  label: string;
};

const scheduleMemberRoleLabels: Record<ScheduleMemberRole, string> = {
  LEADER: "Líder",
  VOCAL: "Vocal",
  INSTRUMENT: "Instrumento",
  MEDIA: "Mídia",
  RECEPTION: "Recepção",
  CHILDREN: "Infantil",
  SUPPORT: "Apoio",
  OTHER: "Outro"
};

export const scheduleMemberRoleOptions = Object.values(ScheduleMemberRole).map((value) => ({
  value,
  label: scheduleMemberRoleLabels[value]
}));

export function getScheduleMemberRolePresentation(
  role: string | null | undefined
): ScheduleMemberRolePresentation {
  if (role && Object.prototype.hasOwnProperty.call(scheduleMemberRoleLabels, role)) {
    const value = role as ScheduleMemberRole;
    return { value, label: scheduleMemberRoleLabels[value] };
  }

  return { value: null, label: "Função não informada" };
}
