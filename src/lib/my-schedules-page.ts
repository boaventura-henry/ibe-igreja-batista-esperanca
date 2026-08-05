import { AppError } from "@/lib/errors";
import { myScheduleService } from "@/services";

type MySchedulesUser = Parameters<typeof myScheduleService.list>[0];
type ListMySchedules = typeof myScheduleService.list;

export async function loadMySchedulesPageData(
  user: MySchedulesUser,
  listMySchedules: ListMySchedules = myScheduleService.list
) {
  try {
    return {
      kind: "ready" as const,
      data: await listMySchedules(user)
    };
  } catch (error) {
    if (
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "USER_WITHOUT_MEMBER"
    ) {
      return { kind: "member-link-required" as const };
    }

    throw error;
  }
}
