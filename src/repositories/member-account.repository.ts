import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { MemberAccountUpdateInput } from "@/validators";

const memberAccountSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  passwordHash: false,
  accessRole: {
    select: {
      id: true,
      name: true
    }
  },
  member: {
    select: {
      id: true,
      name: true,
      cpf: true,
      email: true,
      phone: true,
      mobilePhone: true,
      whatsapp: true
    }
  }
} satisfies Prisma.UserSelect;

const memberAccountWithPasswordSelect = {
  ...memberAccountSelect,
  passwordHash: true
} satisfies Prisma.UserSelect;

export type MemberAccountRecord = Prisma.UserGetPayload<{ select: typeof memberAccountSelect }>;
export type MemberAccountWithPasswordRecord = Prisma.UserGetPayload<{
  select: typeof memberAccountWithPasswordSelect;
}>;

export const memberAccountRepository = {
  findByUserId(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: memberAccountSelect
    });
  },

  findByUserIdWithPassword(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: memberAccountWithPasswordSelect
    });
  },

  async countPhoneMatches(phone: string, currentUserId: string) {
    return prisma.user.count({
      where: {
        id: { not: currentUserId },
        OR: [
          { username: phone },
          { member: { phone } },
          { member: { mobilePhone: phone } },
          { member: { whatsapp: phone } },
          { member: { cpf: phone } }
        ]
      }
    });
  },

  async findEmailConflict(email: string, currentUserId: string, currentMemberId?: string | null) {
    const [user, member] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: { not: currentUserId },
          email
        },
        select: { id: true }
      }),
      prisma.member.findFirst({
        where: {
          id: currentMemberId ? { not: currentMemberId } : undefined,
          email
        },
        select: { id: true }
      })
    ]);

    return user ?? member;
  },

  updateAccount(
    userId: string,
    memberId: string | null | undefined,
    data: MemberAccountUpdateInput & {
      username?: string;
      memberPhones?: { phone?: string | null; mobilePhone?: string | null; whatsapp?: string | null };
    }
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          username: data.username,
          email: data.email ?? undefined
        },
        select: { id: true }
      });

      if (memberId) {
        await tx.member.update({
          where: { id: memberId },
          data: {
            phone: data.memberPhones?.phone,
            mobilePhone: data.memberPhones?.mobilePhone,
            whatsapp: data.memberPhones?.whatsapp,
            email: data.email ?? null,
            updatedById: userId
          },
          select: { id: true }
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: memberAccountSelect
      });
    });
  },

  changePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: false
      },
      select: memberAccountSelect
    });
  }
};
