import { prisma } from "@/prisma/client";

export const databaseRepository = {
  async ping() {
    await prisma.$queryRaw`SELECT 1`;
  }
};
