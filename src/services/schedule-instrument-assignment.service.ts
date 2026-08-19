import { Prisma, ScheduleInstrumentSource, ScheduleMemberRole, ScheduleMemberStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import {
  scheduleInstrumentAssignmentRepository,
  type ScheduleInstrumentAssignmentRecord
} from "@/repositories/schedule-instrument-assignment.repository";
import { scheduleRepository, type ScheduleDatabase } from "@/repositories/schedule.repository";
import type { ScheduleInstrumentAssignmentInput } from "@/validators/schedule-instrument-assignment.validator";

function serialize(value: ScheduleInstrumentAssignmentRecord | null) {
  if (!value) return null;
  return {
    ...value,
    startedAt: value.startedAt.toISOString(),
    endedAt: value.endedAt?.toISOString() ?? null,
    createdAt: value.createdAt.toISOString()
  };
}

async function validateNewAssignment(input: ScheduleInstrumentAssignmentInput, database: ScheduleDatabase) {
  const category = await scheduleInstrumentAssignmentRepository.findCategoryForNewAssignment(
    input.instrumentCategoryId,
    database
  );
  if (!category) {
    throw new AppError("Categoria de instrumento inexistente ou inativa.", 409, "SCHEDULE_INSTRUMENT_CATEGORY_INVALID");
  }
  if (input.source === ScheduleInstrumentSource.OWN) return;
  if (!input.instrumentId) {
    throw new AppError("Instrumento cadastrado e obrigatorio.", 400, "SCHEDULE_INSTRUMENT_REQUIRED");
  }
  const instrument = await scheduleInstrumentAssignmentRepository.findEligibleInstrument(
    input.instrumentId,
    input.instrumentCategoryId,
    database
  );
  if (!instrument) {
    throw new AppError(
      "Instrumento inexistente, indisponivel ou de categoria diferente.",
      409,
      "SCHEDULE_INSTRUMENT_INVALID"
    );
  }
}

export async function createInitialAssignmentInTransaction(
  scheduleMemberId: string,
  role: ScheduleMemberRole,
  input: ScheduleInstrumentAssignmentInput,
  userId: string,
  database: ScheduleDatabase
) {
  if (role !== ScheduleMemberRole.INSTRUMENT) {
    throw new AppError(
      "Somente participantes com funcao Instrumento podem receber instrumento.",
      409,
      "SCHEDULE_INSTRUMENT_ROLE_REQUIRED"
    );
  }
  await validateNewAssignment(input, database);
  if (await scheduleInstrumentAssignmentRepository.findCurrent(scheduleMemberId, database)) {
    throw new AppError("O participante ja possui instrumento ativo.", 409, "SCHEDULE_INSTRUMENT_ALREADY_ASSIGNED");
  }
  try {
    return await scheduleInstrumentAssignmentRepository.createInitial(scheduleMemberId, input, userId, database);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("O participante ja possui instrumento ativo.", 409, "SCHEDULE_INSTRUMENT_ALREADY_ASSIGNED");
    }
    throw error;
  }
}

export function endActiveAssignmentInTransaction(
  scheduleMemberId: string,
  userId: string,
  database: ScheduleDatabase,
  endedAt = new Date()
) {
  return scheduleInstrumentAssignmentRepository.endActive(scheduleMemberId, userId, endedAt, database);
}

function matchesActiveAssignment(
  assignment: ScheduleInstrumentAssignmentRecord,
  input: ScheduleInstrumentAssignmentInput
) {
  return (
    assignment.source === input.source &&
    assignment.instrumentCategory.id === input.instrumentCategoryId &&
    (assignment.instrument?.id ?? null) === (input.instrumentId ?? null) &&
    assignment.changeReason === (input.changeReason ?? null)
  );
}

export async function setActiveAssignmentInTransaction(
  scheduleMemberId: string,
  role: ScheduleMemberRole,
  input: ScheduleInstrumentAssignmentInput,
  userId: string,
  database: ScheduleDatabase
) {
  if (role !== ScheduleMemberRole.INSTRUMENT) {
    throw new AppError(
      "Somente participantes com funcao Instrumento podem receber instrumento.",
      409,
      "SCHEDULE_INSTRUMENT_ROLE_REQUIRED"
    );
  }

  const current = await scheduleInstrumentAssignmentRepository.findCurrent(scheduleMemberId, database);
  if (current && matchesActiveAssignment(current, input)) return current;

  await validateNewAssignment(input, database);

  if (current) {
    await endActiveAssignmentInTransaction(scheduleMemberId, userId, database);
  }

  try {
    return await scheduleInstrumentAssignmentRepository.createInitial(scheduleMemberId, input, userId, database);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await scheduleInstrumentAssignmentRepository.findCurrent(scheduleMemberId, database);
      if (concurrent && matchesActiveAssignment(concurrent, input)) return concurrent;
      throw new AppError("O participante ja possui instrumento ativo.", 409, "SCHEDULE_INSTRUMENT_ALREADY_ASSIGNED");
    }
    throw error;
  }
}
export const scheduleInstrumentAssignmentService = {
  async getCurrent(scheduleId: string, scheduleMemberId: string, authorization: ScheduleAuthorization) {
    const schedule = await scheduleRepository.findByIdWithinScope(scheduleId, authorization.accessContext);
    if (!schedule) throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    const participant = await scheduleInstrumentAssignmentRepository.findParticipant(scheduleMemberId, scheduleId);
    if (!participant) throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
    return serialize(await scheduleInstrumentAssignmentRepository.findCurrent(scheduleMemberId));
  },

  async createInitial(
    scheduleId: string,
    scheduleMemberId: string,
    input: ScheduleInstrumentAssignmentInput,
    authorization: ScheduleAuthorization
  ) {
    const value = await scheduleRepository.transaction(async (database) => {
      const schedule = await scheduleRepository.lockByIdWithinScope(
        scheduleId,
        authorization.accessContext,
        database
      );
      if (!schedule) throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
      const participant = await scheduleInstrumentAssignmentRepository.findParticipant(
        scheduleMemberId,
        scheduleId,
        database
      );
      if (!participant) throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
      if (participant.status === ScheduleMemberStatus.REPLACED) {
        throw new AppError("Participante substituido nao pode receber nova alocacao.", 409, "SCHEDULE_MEMBER_REPLACED");
      }
      return setActiveAssignmentInTransaction(
        participant.id,
        participant.role,
        input,
        authorization.user.id,
        database
      );
    });
    return serialize(value);
  },

  async listEligible(scheduleId: string, categoryId: string, authorization: ScheduleAuthorization) {
    const schedule = await scheduleRepository.findByIdWithinScope(scheduleId, authorization.accessContext);
    if (!schedule) throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    const category = await scheduleInstrumentAssignmentRepository.findCategoryForNewAssignment(categoryId);
    if (!category) {
      throw new AppError("Categoria de instrumento inexistente ou inativa.", 409, "SCHEDULE_INSTRUMENT_CATEGORY_INVALID");
    }
    return {
      category,
      instruments: await scheduleInstrumentAssignmentRepository.listEligible(categoryId)
    };
  }
};