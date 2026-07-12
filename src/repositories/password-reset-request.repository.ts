import { PasswordResetRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { PasswordResetRequestListQueryInput } from "@/validators";

const passwordResetRequestSelect = {
  id: true,
  identifier: true,
  normalizedIdentifier: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  status: true,
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      member: {
        select: {
          id: true,
          name: true,
          cpf: true
        }
      }
    }
  },
  processedBy: {
    select: {
      id: true,
      name: true
    }
  },
  requestedAt: true,
  processedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.PasswordResetRequestSelect;

export type SafePasswordResetRequest = Prisma.PasswordResetRequestGetPayload<{
  select: typeof passwordResetRequestSelect;
}>;

function buildWhere(filters: PasswordResetRequestListQueryInput): Prisma.PasswordResetRequestWhereInput {
  const and: Prisma.PasswordResetRequestWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { identifier: { contains: filters.search, mode: "insensitive" } },
        { normalizedIdentifier: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
        { cpf: { contains: filters.search, mode: "insensitive" } },
        { user: { name: { contains: filters.search, mode: "insensitive" } } },
        { user: { username: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  return { AND: and };
}

export const passwordResetRequestRepository = {
  async list(filters: PasswordResetRequestListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = {
      [filters.sortBy]: filters.sortOrder
    } satisfies Prisma.PasswordResetRequestOrderByWithRelationInput;

    const [requests, total] = await prisma.$transaction([
      prisma.passwordResetRequest.findMany({
        where,
        select: passwordResetRequestSelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.passwordResetRequest.count({ where })
    ]);

    return { requests, total };
  },

  findById(id: string) {
    return prisma.passwordResetRequest.findFirst({
      where: { id, deletedAt: null },
      select: passwordResetRequestSelect
    });
  },

  findPendingDuplicate(normalizedIdentifier: string) {
    return prisma.passwordResetRequest.findFirst({
      where: {
        normalizedIdentifier,
        status: PasswordResetRequestStatus.PENDING,
        deletedAt: null
      },
      select: { id: true }
    });
  },

  async findUserByIdentifier(identifier: string) {
    const digits = identifier.replace(/\D/g, "");
    const select = {
      id: true,
      name: true,
      username: true,
      email: true,
      isActive: true,
      member: {
        select: {
          id: true,
          name: true,
          cpf: true,
          phone: true,
          mobilePhone: true,
          whatsapp: true
        }
      }
    } satisfies Prisma.UserSelect;

    if (digits.length >= 10) {
      const phoneMatches = await prisma.user.findMany({
        where: {
          OR: [
            { member: { phone: digits } },
            { member: { mobilePhone: digits } },
            { member: { whatsapp: digits } }
          ]
        },
        select,
        take: 2
      });

      if (phoneMatches.length === 1) {
        return phoneMatches[0];
      }
    }

    if (digits.length === 11) {
      const cpfMatches = await prisma.user.findMany({
        where: { member: { cpf: digits } },
        select,
        take: 2
      });

      if (cpfMatches.length === 1) {
        return cpfMatches[0];
      }
    }

    return null;
  },

  create(data: {
    identifier: string;
    normalizedIdentifier: string;
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string;
      userId?: string | null;
  }) {
    return prisma.passwordResetRequest.create({
      data: {
        identifier: data.identifier,
        normalizedIdentifier: data.normalizedIdentifier,
        name: data.name,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        userId: data.userId
      },
      select: passwordResetRequestSelect
    });
  },

  approve(id: string, actionUserId: string, targetUserId: string, passwordHash: string) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null
        },
        select: { id: true }
      });

      return tx.passwordResetRequest.update({
        where: { id },
        data: {
          status: PasswordResetRequestStatus.COMPLETED,
          processedById: actionUserId,
          processedAt: new Date(),
          rejectionReason: null,
          userId: targetUserId
        },
        select: passwordResetRequestSelect
      });
    });
  },

  reject(id: string, actionUserId: string, reason: string) {
    return prisma.passwordResetRequest.update({
      where: { id },
      data: {
        status: PasswordResetRequestStatus.REJECTED,
        processedById: actionUserId,
        processedAt: new Date(),
        rejectionReason: reason
      },
      select: passwordResetRequestSelect
    });
  }
};
