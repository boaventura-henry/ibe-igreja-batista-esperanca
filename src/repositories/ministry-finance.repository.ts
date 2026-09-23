import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/prisma/client";

const ACCESS_UPDATE_ATTEMPTS = 5;

export const ministryFinanceRepository = {
  listAuthorizedMinistryIds(userId: string) {
    return prisma.ministryFinancialAccess.findMany({
      where: { userId },
      select: { ministryId: true },
      orderBy: { ministryId: "asc" }
    });
  },

  async getAccessConfiguration(userId: string) {
    const [user, ministries, accesses] = await prisma.$transaction([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
      prisma.ministry.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      }),
      prisma.ministryFinancialAccess.findMany({ where: { userId }, select: { ministryId: true } })
    ]);
    return { user, ministries, accesses };
  },

  listExistingMinistries(ministryIds: string[]) {
    return prisma.ministry.findMany({
      where: { id: { in: ministryIds }, deletedAt: null },
      select: { id: true, isActive: true }
    });
  },

  async replaceAccesses(userId: string, ministryIds: string[], createdById: string) {
    for (let attempt = 1; attempt <= ACCESS_UPDATE_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          await tx.ministryFinancialAccess.deleteMany({ where: { userId } });
          if (ministryIds.length) {
            await tx.ministryFinancialAccess.createMany({
              data: ministryIds.map((ministryId) => ({ userId, ministryId, createdById }))
            });
          }
          return tx.ministryFinancialAccess.findMany({ where: { userId }, select: { ministryId: true } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
        if (attempt === ACCESS_UPDATE_ATTEMPTS) {
          throw new AppError("Nao foi possivel atualizar os acessos ministeriais agora. Tente novamente.", 409, "MINISTRY_FINANCE_ACCESS_CONFLICT");
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 25));
      }
    }
    throw new AppError("Nao foi possivel atualizar os acessos ministeriais agora. Tente novamente.", 409, "MINISTRY_FINANCE_ACCESS_CONFLICT");
  }
};
