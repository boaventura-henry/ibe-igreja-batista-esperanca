import { databaseRepository } from "@/repositories";

export const healthService = {
  async checkDatabase() {
    await databaseRepository.ping();

    return {
      status: "ok" as const,
      database: "connected" as const
    };
  }
};
