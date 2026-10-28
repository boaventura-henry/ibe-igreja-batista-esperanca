import { Prisma, PrismaClient, VisitorStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { visitorRepository, type VisitorRecord } from "@/repositories";
import type {
  VisitorAdminUpdateInput,
  VisitorCreateInput,
  VisitorListQueryInput,
  VisitorPrivacyRecordInput
} from "@/validators";

const MAX_VISITOR_TRANSACTION_ATTEMPTS = 3;
const RETRYABLE_CODES = new Set(["P2002", "P2034", "40001", "40P01"]);

export type VisitorCheckInInput = {
  visitor: VisitorCreateInput;
  privacy: VisitorPrivacyRecordInput;
  visitDate: Date;
  reactivateInactive?: boolean;
};

export type VisitorCheckInResult = { visitor: VisitorRecord; created: boolean; reactivated: boolean };

function civilDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function serializeVisitor(visitor: VisitorRecord) {
  return {
    id: visitor.id,
    name: visitor.name,
    phone: visitor.phone,
    birthDate: civilDateString(visitor.birthDate),
    street: visitor.street,
    number: visitor.number,
    complement: visitor.complement,
    district: visitor.district,
    city: visitor.city,
    state: visitor.state,
    status: visitor.status,
    createdAt: visitor.createdAt.toISOString(),
    updatedAt: visitor.updatedAt.toISOString()
  };
}

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
  async list(filters: VisitorListQueryInput) {
    const result = await visitorRepository.list(filters);
    return {
      visitors: result.visitors.map((visitor) => ({
        ...visitor,
        birthDate: civilDateString(visitor.birthDate),
        createdAt: visitor.createdAt.toISOString(),
        updatedAt: visitor.updatedAt.toISOString()
      })),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  },

  async getDetail(id: string) {
    const visitor = await visitorRepository.findDetailById(id);
    if (!visitor) throw new AppError("Visitante nao encontrado.", 404, "VISITOR_NOT_FOUND");
    const summary = await visitorRepository.visitSummary(id);
    return {
      ...serializeVisitor(visitor),
      createdBy: visitor.createdBy,
      updatedBy: visitor.updatedBy,
      privacyRecords: visitor.privacyRecords.map((record) => ({
        ...record,
        acknowledgedAt: record.acknowledgedAt.toISOString(),
        createdAt: record.createdAt.toISOString()
      })),
      visitSummary: {
        visitCount: summary._count._all,
        firstVisit: summary._min.visitDate ? civilDateString(summary._min.visitDate) : null,
        latestVisit: summary._max.visitDate ? civilDateString(summary._max.visitDate) : null
      }
    };
  },

  async listVisits(id: string, filters: Pick<VisitorListQueryInput, "page" | "pageSize">) {
    const result = await visitorRepository.listVisits(id, filters.page, filters.pageSize);
    if (!result.visitorFound) throw new AppError("Visitante nao encontrado.", 404, "VISITOR_NOT_FOUND");
    return {
      visits: result.visits.map((visit) => ({
        ...visit,
        visitDate: civilDateString(visit.visitDate),
        createdAt: visit.createdAt.toISOString()
      })),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  },

  async updateAdmin(id: string, input: VisitorAdminUpdateInput, userId: string) {
    const current = await visitorRepository.findById(id);
    if (!current) throw new AppError("Visitante nao encontrado.", 404, "VISITOR_NOT_FOUND");
    if (current.status === VisitorStatus.CONVERTED) {
      throw new AppError("Visitantes convertidos nao podem ser alterados por este formulario.", 409, "VISITOR_CONVERTED_READ_ONLY");
    }
    const phone = input.phone ?? current.phone;
    const birthDate = input.birthDate ?? current.birthDate;
    const conflict = await visitorRepository.findIdentityConflict(phone, birthDate, id);
    if (conflict) {
      throw new AppError("Ja existe um visitante com esta identidade.", 409, "VISITOR_IDENTITY_CONFLICT");
    }
    try {
      return serializeVisitor(await visitorRepository.update(id, input, userId));
    } catch (error) {
      const code = transactionCode(error);
      if (code === "P2002") {
        throw new AppError("Ja existe um visitante com esta identidade.", 409, "VISITOR_IDENTITY_CONFLICT");
      }
      if (code === "P2025") {
        const latest = await visitorRepository.findById(id);
        if (!latest) throw new AppError("Visitante nao encontrado.", 404, "VISITOR_NOT_FOUND");
        if (latest.status === VisitorStatus.CONVERTED) {
          throw new AppError("Visitantes convertidos nao podem ser alterados por este formulario.", 409, "VISITOR_CONVERTED_READ_ONLY");
        }
      }
      throw error;
    }
  },

  async removeAdmin(id: string, userId: string) {
    const result = await visitorRepository.softDelete(id, userId);
    if (result.count === 0) throw new AppError("Visitante nao encontrado.", 404, "VISITOR_NOT_FOUND");
    return { id, deletedAt: new Date().toISOString() };
  },

  async checkInExisting(input: { phone: string; birthDate: Date; privacy: VisitorPrivacyRecordInput; visitDate: Date }, client?: PrismaClient): Promise<boolean> {
    return runVisitorTransaction(() => visitorRepository.transaction(async (database) => {
      const current = await visitorRepository.findByIdentity(input.phone, input.birthDate, database);
      if (!current) return false;
      const visitor = current.status === VisitorStatus.INACTIVE
        ? await visitorRepository.reactivate(current.id, database)
        : current;
      await visitorRepository.upsertPrivacyRecord(visitor.id, input.privacy.noticeVersion, input.privacy.channel, database);
      await visitorRepository.upsertVisit(visitor.id, input.visitDate, database);
      return true;
    }, client));
  },
  async checkIn(input: VisitorCheckInInput, client?: PrismaClient): Promise<VisitorCheckInResult> {
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
      }, client));
    } catch (error) {
      if (transactionCode(error) === "P2002") {
        throw new AppError("A identidade do visitante esta indisponivel para um novo cadastro.", 409, "VISITOR_IDENTITY_UNAVAILABLE");
      }
      throw error;
    }
  }
};
