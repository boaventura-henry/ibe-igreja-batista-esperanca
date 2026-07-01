import type { MemberMinistryRole, MemberMinistryStatus, MemberStatus, ScheduleMemberRole, ScheduleMemberStatus } from "@prisma/client";

export type MemberPortalProfile = {
  id: string;
  name: string;
  cpf: string | null;
  rg: string | null;
  birthDate: string | null;
  status: MemberStatus;
  phone: string | null;
  mobilePhone: string | null;
  whatsapp: string | null;
  email: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

export type MemberPortalMinistry = {
  id: string;
  role: MemberMinistryRole;
  status: MemberMinistryStatus;
  entryDate: string;
  exitDate: string | null;
  ministry: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    leader: {
      id: string;
      name: string;
      phone: string | null;
      mobilePhone: string | null;
    } | null;
  };
};

export type MemberPortalSchedulePreview = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  role: ScheduleMemberRole;
  status: ScheduleMemberStatus;
  ministry: {
    id: string;
    name: string;
    color: string;
  };
};

export type MemberPortalDashboard = {
  member: MemberPortalProfile | null;
  nextSchedules: MemberPortalSchedulePreview[];
  ministries: MemberPortalMinistry[];
};

export type MemberPortalUpdateProfileInput = {
  phone?: string | null;
  mobilePhone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};
