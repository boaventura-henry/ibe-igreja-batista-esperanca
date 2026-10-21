import { Prisma, VisitorStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { visitorRepository, type VisitorRecord } from "@/repositories";
import type { VisitorCreateInput, VisitorPrivacyRecordInput } from "@/validators";

const MAX_VISITOR_TRANSACTION_ATTEMPTS = 3;
const RETRYABLE_CODES = new Set(["P2002", "P2034", "40001", "40P01"]);

export type VisitorCheckInInput = {
  visitor: VisitorCreateInput;
  privacy: VisitorPrivacyRecordInput;
  visitDate: Date;
  reactivateInactive?: boolean;
};

export type VisitorCheckInResult = { visitor: VisitorRecord; created: boolean; reactivated: boolean };

function transactionCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string") return candidate.code;
  return candidate.cause ? transactionCode(candidate.cause) : null;
}

async function runVisitorTransaction<T>(operation: () => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_VISITOR_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!RETRYABLE_CODES.has(transactionCode(error) ?? "") || attempt === MAX_VISITOR_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw new Error("Visitor transaction retry limit reached.");
}

export const visitorService = {
  async checkIn(input: VisitorCheckInInput): Promise<VisitorCheckInResult> {
    if (input.visitor.status === VisitorStatus.CONVERTED) {
      throw new AppError("O status convertido nao esta disponivel para check-in.", 400, "VISITOR_STATUS_UNAVAILABLE");
    }
    try {
      return await runVisitorTransaction(() => visitorRepository.transaction(async (database) => {
        const current = await visitorRepository.findByIdentity(input.visitor.phone, input.visitor.birthDate, database);
        if (current) {
          const reactivated = current.status === VisitorStatus.INACTIVE && input.reactivateInactive === true;
          const visitor = reactivated ? await visitorRepository.reactivate(current.id, database) : current;
          await visitorRepository.upsertPrivacyRecord(visitor.id, input.privacy.noticeVersion, input.privacy.channel, database);
          await visitorRepository.upsertVisit(visitor.id, input.visitDate, database);
          return { visitor, created: false, reactivated };
        }

        const visitor = await visitorRepository.create(input.visitor, undefined, database);
        await visitorRepository.upsertPrivacyRecord(visitor.id, input.privacy.noticeVersion, input.privacy.channel, database);
        await visitorRepository.upsertVisit(visitor.id, input.visitDate, database);
        return { visitor, created: true, reactivated: false };
      }));
    } catch (error) {
      if (transactionCode(error) === "P2002") {
        throw new AppError("A identidade do visitante esta indisponivel para um novo cadastro.", 409, "VISITOR_IDENTITY_UNAVAILABLE");
      }
      throw error;
    }
  }
};
