import { AppError } from "@/lib/errors";
import { financialEntryRepository } from "@/repositories/financial-entry.repository";
import type { MemberContributionListResult, MemberContributionSummary } from "@/types";

function serialize(entry: Awaited<ReturnType<typeof financialEntryRepository.listPortalContributions>>[number]): MemberContributionSummary {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    category: entry.category.name,
    amount: entry.amount.toString(),
    paymentMethod: entry.paymentMethod,
    status: entry.status,
    launchDate: entry.launchDate.toISOString(),
    referenceDate: entry.referenceDate.toISOString()
  };
}

export const memberContributionService = {
  async listForUser(memberId: string | null | undefined): Promise<MemberContributionListResult> {
    if (!memberId) {
      throw new AppError("Seu usuario ainda nao esta vinculado a um membro.", 409, "USER_WITHOUT_MEMBER");
    }

    return {
      contributions: (await financialEntryRepository.listPortalContributions(memberId)).map(serialize)
    };
  }
};
