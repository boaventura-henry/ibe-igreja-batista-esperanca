import { ScheduleMemberRole } from "@prisma/client";

type ScheduleMemberRolePresentation = {
  value: ScheduleMemberRole | null;
  label: string;
};

type ScheduleMemberRoleEntry = ScheduleMemberRole | { role: ScheduleMemberRole };

export type ScheduleMemberRoleSource =
  | ScheduleMemberRole
  | {
      role?: ScheduleMemberRole | null;
      roles?: readonly ScheduleMemberRoleEntry[] | null;
    };

const scheduleMemberRoleLabels: Record<ScheduleMemberRole, string> = {
  MINISTER: "Ministro",
  LEADER: "Líder",
  VOCAL: "Vocal",
  BACKING: "Backing",
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

const scheduleMemberRolePriority = new Map(
  scheduleMemberRoleOptions.map((option, index) => [option.value, index])
);

export function normalizeScheduleMemberRoles(roles: readonly ScheduleMemberRole[]) {
  return [...new Set(roles)].sort(
    (left, right) =>
      (scheduleMemberRolePriority.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (scheduleMemberRolePriority.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function getScheduleMemberRoles(source: ScheduleMemberRoleSource) {
  if (typeof source === "string") return [source];
  if (source.roles !== undefined && source.roles !== null) {
    const assigned = source.roles.map((entry) =>
      typeof entry === "string" ? entry : entry.role
    );
    return normalizeScheduleMemberRoles(assigned);
  }
  return source.role ? [source.role] : [];
}

export function hasScheduleMemberRole(
  source: ScheduleMemberRoleSource,
  role: ScheduleMemberRole
) {
  return getScheduleMemberRoles(source).includes(role);
}

export function hasInstrumentRole(source: ScheduleMemberRoleSource) {
  return hasScheduleMemberRole(source, ScheduleMemberRole.INSTRUMENT);
}

export function resolveLegacyScheduleMemberRole(
  currentRole: ScheduleMemberRole | null | undefined,
  roles: readonly ScheduleMemberRole[]
) {
  const normalized = normalizeScheduleMemberRoles(roles);
  if (!normalized.length) return null;
  return currentRole && normalized.includes(currentRole) ? currentRole : normalized[0];
}

export function getScheduleMemberRolePresentation(
  role: string | null | undefined
): ScheduleMemberRolePresentation {
  if (role && Object.prototype.hasOwnProperty.call(scheduleMemberRoleLabels, role)) {
    const value = role as ScheduleMemberRole;
    return { value, label: scheduleMemberRoleLabels[value] };
  }

  return { value: null, label: "Função não informada" };
}

type ScheduleMemberInstrumentAssignmentDisplay = {
  instrumentCategory?: { name?: string | null } | null;
} | null | undefined;

export function getScheduleMemberDisplayRole(
  role: string | null | undefined,
  instrumentAssignment?: ScheduleMemberInstrumentAssignmentDisplay
) {
  const categoryName = instrumentAssignment?.instrumentCategory?.name?.trim();

  if (role === ScheduleMemberRole.INSTRUMENT && categoryName) {
    return categoryName;
  }

  return getScheduleMemberRolePresentation(role).label;
}

export function getScheduleMemberDisplayRoles(
  source: ScheduleMemberRoleSource,
  instrumentAssignment?: ScheduleMemberInstrumentAssignmentDisplay
) {
  const categoryName = instrumentAssignment?.instrumentCategory?.name?.trim();
  const presentationRoles = [...getScheduleMemberRoles(source)].sort((left, right) => {
    const presentationPriority = (role: ScheduleMemberRole) => {
      const officialPriority = scheduleMemberRolePriority.get(role) ?? Number.MAX_SAFE_INTEGER;
      if (role === ScheduleMemberRole.LEADER) return officialPriority - 2;
      if (role === ScheduleMemberRole.INSTRUMENT) return officialPriority - 1.5;
      return officialPriority;
    };

    return presentationPriority(left) - presentationPriority(right);
  });

  if (!presentationRoles.length) {
    return "Função não informada";
  }

  return presentationRoles
    .map((role) =>
      role === ScheduleMemberRole.INSTRUMENT && categoryName
        ? categoryName
        : getScheduleMemberRolePresentation(role).label
    )
    .join(" • ");
}
