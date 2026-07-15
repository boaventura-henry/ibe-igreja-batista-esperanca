export type MemberDisplayNameSource = {
  name: string;
  nickname?: string | null;
};

export function getMemberDisplayName(member: MemberDisplayNameSource) {
  return member.nickname?.trim() || member.name;
}

export function getMemberOptionLabel(member: MemberDisplayNameSource) {
  const displayName = getMemberDisplayName(member);
  return displayName === member.name ? displayName : `${displayName} - ${member.name}`;
}
