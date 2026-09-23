import { AppError } from "@/lib/errors";
import { ministryFinanceRepository } from "@/repositories/ministry-finance.repository";
import type { MinistryFinancialAccessResult } from "@/types/ministry-finance.types";
import type { MinistryFinancialAccessUpdateInput } from "@/validators/ministry-finance.validator";

export const ministryFinanceService = {
  async getAccessConfiguration(userId: string): Promise<MinistryFinancialAccessResult> {
    const result = await ministryFinanceRepository.getAccessConfiguration(userId);
    if (!result.user) throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    const selected = new Set(result.accesses.map((item) => item.ministryId));
    return {
      user: result.user,
      ministries: result.ministries.map((ministry) => ({ ...ministry, selected: selected.has(ministry.id) }))
    };
  },

  async updateAccessConfiguration(userId: string, input: MinistryFinancialAccessUpdateInput, createdById: string) {
    const uniqueIds = [...new Set(input.ministryIds)];
    const [configuration, existing] = await Promise.all([
      this.getAccessConfiguration(userId),
      ministryFinanceRepository.listExistingMinistries(uniqueIds)
    ]);
    const previouslySelected = new Set(configuration.ministries.filter((item) => item.selected).map((item) => item.id));
    if (existing.length !== uniqueIds.length || existing.some((ministry) => !ministry.isActive && !previouslySelected.has(ministry.id))) {
      throw new AppError("Um ou mais ministerios estao invalidos ou inativos.", 400, "INVALID_MINISTRY_SCOPE");
    }
    await ministryFinanceRepository.replaceAccesses(userId, uniqueIds, createdById);
    return this.getAccessConfiguration(userId);
  }
};
