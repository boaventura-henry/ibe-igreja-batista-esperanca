import { AppError } from "@/lib/errors";
import { instrumentUsageHistoryRepository } from "@/repositories";
import type { InstrumentUsageHistoryResult } from "@/types";
import { getMemberDisplayName } from "@/utils";
import type { InstrumentUsageHistoryQueryInput } from "@/validators";

export const instrumentUsageHistoryService = {
  async list(
    instrumentId: string,
    filters: InstrumentUsageHistoryQueryInput
  ): Promise<InstrumentUsageHistoryResult> {
    if (!(await instrumentUsageHistoryRepository.findInstrument(instrumentId))) {
      throw new AppError(
        "Instrumento nao encontrado.",
        404,
        "INSTRUMENT_NOT_FOUND"
      );
    }
    const result = await instrumentUsageHistoryRepository.list(
      instrumentId,
      filters
    );

    return {
      items: result.items.map((item) => ({
        id: item.id,
        startedAt: item.startedAt.toISOString(),
        endedAt: item.endedAt?.toISOString() ?? null,
        changeReason: item.changeReason,
        member: {
          id: item.scheduleMember.member.id,
          name: item.scheduleMember.member.name,
          displayName: getMemberDisplayName(item.scheduleMember.member)
        },
        category: item.instrumentCategory,
        scheduleMember: {
          id: item.scheduleMember.id,
          status: item.scheduleMember.status
        },
        schedule: {
          id: item.scheduleMember.schedule.id,
          title: item.scheduleMember.schedule.title,
          date: item.scheduleMember.schedule.date.toISOString(),
          deletedAt:
            item.scheduleMember.schedule.deletedAt?.toISOString() ?? null
        }
      })),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  }
};
