import { Prisma, ScheduleStatus } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { MemberPortalUpdateProfileInput } from "@/validators";

const portalProfileSelect = {
  id: true,
  name: true,
  cpf: true,
  rg: true,
  birthDate: true,
  status: true,
  phone: true,
  mobilePhone: true,
  whatsapp: true,
  email: true,
  zipCode: true,
  street: true,
  number: true,
  complement: true,
  district: true,
  city: true,
  state: true
} satisfies Prisma.MemberSelect;

const portalMinistrySelect = {
  id: true,
  role: true,
  status: true,
  entryDate: true,
  exitDate: true,
  ministry: {
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      leaderMember: {
        select: {
          id: true,
          name: true,
          phone: true,
          mobilePhone: true
        }
      }
    }
  }
} satisfies Prisma.MemberMinistrySelect;

const portalSchedulePreviewSelect = {
  id: true,
  role: true,
  status: true,
  schedule: {
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      ministry: {
        select: {
          id: true,
          name: true,
          color: true
        }
      }
    }
  }
} satisfies Prisma.ScheduleMemberSelect;

export type MemberPortalProfileRecord = Prisma.MemberGetPayload<{ select: typeof portalProfileSelect }>;
export type MemberPortalMinistryRecord = Prisma.MemberMinistryGetPayload<{ select: typeof portalMinistrySelect }>;
export type MemberPortalScheduleRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof portalSchedulePreviewSelect }>;

export const memberPortalRepository = {
  findProfile(memberId: string) {
    return prisma.member.findFirst({
      where: { id: memberId, deletedAt: null },
      select: portalProfileSelect
    });
  },

  findMemberByEmail(email: string) {
    return prisma.member.findUnique({
      where: { email },
      select: { id: true }
    });
  },

  updateProfile(memberId: string, data: MemberPortalUpdateProfileInput, userId: string) {
    return prisma.member.update({
      where: { id: memberId },
      data: {
        phone: data.phone,
        mobilePhone: data.mobilePhone,
        whatsapp: data.whatsapp,
        email: data.email,
        zipCode: data.zipCode,
        street: data.street,
        number: data.number,
        complement: data.complement,
        district: data.district,
        city: data.city,
        state: data.state,
        updatedById: userId
      },
      select: portalProfileSelect
    });
  },

  listMinistries(memberId: string) {
    return prisma.memberMinistry.findMany({
      where: {
        memberId,
        deletedAt: null
      },
      select: portalMinistrySelect,
      orderBy: [{ status: "asc" }, { entryDate: "desc" }]
    });
  },

  listNextSchedules(memberId: string, limit = 5) {
    return prisma.scheduleMember.findMany({
      where: {
        memberId,
        deletedAt: null,
        schedule: {
          deletedAt: null,
          status: { notIn: [ScheduleStatus.CANCELED, ScheduleStatus.COMPLETED] },
          date: { gte: new Date(new Date().toISOString().slice(0, 10)) }
        }
      },
      select: portalSchedulePreviewSelect,
      orderBy: [{ schedule: { date: "asc" } }, { schedule: { startTime: "asc" } }],
      take: limit
    });
  }
};
