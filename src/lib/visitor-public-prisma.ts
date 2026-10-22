import { PrismaClient } from "@prisma/client";

const cache = globalThis as typeof globalThis & { visitorPublicPrisma?: PrismaClient };

// Public check-in errors may contain submitted PII; the shared Prisma client logs errors.
export const visitorPublicPrisma = cache.visitorPublicPrisma ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== "production") cache.visitorPublicPrisma = visitorPublicPrisma;
