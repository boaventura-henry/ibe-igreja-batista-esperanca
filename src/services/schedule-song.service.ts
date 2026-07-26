import { ScheduleStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import { scheduleSongRepository } from "@/repositories";
import type {
  ScheduleSongCopyInput,
  ScheduleSongCreateInput,
  ScheduleSongUpdateInput
} from "@/validators";
import { getMemberDisplayName } from "@/utils";
import { scheduleService } from "./schedule.service";

function serialize<T extends { createdAt: Date; updatedAt: Date }>(item: T) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

async function buildRepertoire(scheduleId: string, ministryId: string) {
  const [songs, members, sources] = await Promise.all([
    scheduleSongRepository.list(scheduleId),
    scheduleSongRepository.listScheduleMembers(scheduleId),
    scheduleSongRepository.listSourceSchedules(scheduleId, ministryId)
  ]);

  return {
    songs: songs.map((item) => ({
      ...serialize(item),
      leadMember: item.leadMember
        ? { ...item.leadMember, displayName: getMemberDisplayName(item.leadMember) }
        : null
    })),
    members: members.map((item) => ({
      ...item.member,
      displayName: getMemberDisplayName(item.member)
    })),
    sources: sources.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date.toISOString(),
      songCount: item._count.songs
    }))
  };
}

export const scheduleSongService = {
  async list(scheduleId: string, authorization: ScheduleAuthorization) {
    const schedule = await scheduleService.getById(scheduleId, authorization);

    return buildRepertoire(scheduleId, schedule.ministry.id);
  },

  async add(
    scheduleId: string,
    input: ScheduleSongCreateInput,
    authorization: ScheduleAuthorization
  ) {
    const schedule = await scheduleService.getById(scheduleId, authorization);

    if (
      schedule.status === ScheduleStatus.COMPLETED ||
      schedule.status === ScheduleStatus.CANCELED
    ) {
      throw new AppError(
        "Esta escala nao pode receber repertorio.",
        409,
        "SCHEDULE_LOCKED"
      );
    }

    if (!(await scheduleSongRepository.findActiveSong(input.songId))) {
      throw new AppError("Musica ativa nao encontrada.", 404, "SONG_NOT_FOUND");
    }

    if (await scheduleSongRepository.findSongDuplicate(scheduleId, input.songId)) {
      throw new AppError(
        "Esta musica ja esta no repertorio.",
        409,
        "SCHEDULE_SONG_DUPLICATED"
      );
    }

    if (
      input.leadMemberId &&
      !(await scheduleSongRepository.listScheduleMembers(scheduleId)).some(
        (item) => item.member.id === input.leadMemberId
      )
    ) {
      throw new AppError(
        "O ministro deve ser participante ativo da escala.",
        400,
        "INVALID_LEAD_MEMBER"
      );
    }

    const position =
      input.position ||
      ((await scheduleSongRepository.maxPosition(scheduleId))._max.position ?? 0) + 1;

    return serialize(
      await scheduleSongRepository.create(
        scheduleId,
        { ...input, position },
        authorization.user.id
      )
    );
  },

  async update(
    scheduleId: string,
    id: string,
    input: ScheduleSongUpdateInput,
    authorization: ScheduleAuthorization
  ) {
    const schedule = await scheduleService.getById(scheduleId, authorization);

    if (
      schedule.status === ScheduleStatus.COMPLETED ||
      schedule.status === ScheduleStatus.CANCELED
    ) {
      throw new AppError("Esta escala nao pode ser alterada.", 409, "SCHEDULE_LOCKED");
    }

    const current = await scheduleSongRepository.findById(scheduleId, id);

    if (!current) {
      throw new AppError(
        "Musica do repertorio nao encontrada.",
        404,
        "SCHEDULE_SONG_NOT_FOUND"
      );
    }

    if (
      input.songId &&
      (await scheduleSongRepository.findSongDuplicate(scheduleId, input.songId, id))
    ) {
      throw new AppError(
        "Esta musica ja esta no repertorio.",
        409,
        "SCHEDULE_SONG_DUPLICATED"
      );
    }

    if (
      input.leadMemberId &&
      !(await scheduleSongRepository.listScheduleMembers(scheduleId)).some(
        (item) => item.member.id === input.leadMemberId
      )
    ) {
      throw new AppError(
        "O ministro deve ser participante ativo da escala.",
        400,
        "INVALID_LEAD_MEMBER"
      );
    }

    if (
      input.position &&
      (await scheduleSongRepository.findActivePosition(scheduleId, input.position, id))
    ) {
      throw new AppError(
        "Ja existe uma musica nessa posicao.",
        409,
        "SCHEDULE_SONG_POSITION_DUPLICATED"
      );
    }

    return serialize(
      await scheduleSongRepository.update(id, input, authorization.user.id)
    );
  },

  async remove(
    scheduleId: string,
    id: string,
    authorization: ScheduleAuthorization
  ) {
    const schedule = await scheduleService.getById(scheduleId, authorization);

    if (
      schedule.status === ScheduleStatus.COMPLETED ||
      schedule.status === ScheduleStatus.CANCELED
    ) {
      throw new AppError("Esta escala nao pode ser alterada.", 409, "SCHEDULE_LOCKED");
    }

    if (!(await scheduleSongRepository.findById(scheduleId, id))) {
      throw new AppError(
        "Musica do repertorio nao encontrada.",
        404,
        "SCHEDULE_SONG_NOT_FOUND"
      );
    }

    return scheduleSongRepository.softDeleteAndRecompact(
      scheduleId,
      id,
      authorization.user.id
    );
  },

  async reorder(
    scheduleId: string,
    id: string,
    direction: "up" | "down",
    authorization: ScheduleAuthorization
  ) {
    const schedule = await scheduleService.getById(scheduleId, authorization);
    await scheduleSongRepository.reorder(
      scheduleId,
      id,
      direction,
      authorization.user.id
    );

    return buildRepertoire(scheduleId, schedule.ministry.id);
  },

  async copy(
    scheduleId: string,
    input: ScheduleSongCopyInput,
    authorization: ScheduleAuthorization
  ) {
    const destination = await scheduleService.getById(scheduleId, authorization);
    const source = await scheduleService.getById(
      input.sourceScheduleId,
      authorization
    );

    if (scheduleId === input.sourceScheduleId) {
      throw new AppError(
        "A escala origem e destino devem ser diferentes.",
        400,
        "INVALID_SOURCE_SCHEDULE"
      );
    }

    if (destination.ministry.id !== source.ministry.id) {
      throw new AppError(
        "A escala origem deve ser do mesmo ministerio.",
        400,
        "INVALID_SOURCE_SCHEDULE"
      );
    }

    if (
      destination.status === ScheduleStatus.COMPLETED ||
      destination.status === ScheduleStatus.CANCELED
    ) {
      throw new AppError(
        "A escala destino nao pode receber repertorio.",
        409,
        "SCHEDULE_LOCKED"
      );
    }

    const [sourceItems, destinationItems] = await Promise.all([
      scheduleSongRepository.listForCopy(input.sourceScheduleId),
      scheduleSongRepository.list(scheduleId)
    ]);

    if (sourceItems.some((item) => item.song.deletedAt || !item.song.isActive)) {
      throw new AppError(
        "A escala origem possui uma musica inativa ou removida do catalogo.",
        409,
        "SONG_NOT_AVAILABLE"
      );
    }

    if (
      input.mode === "append" &&
      sourceItems.some((item) =>
        destinationItems.some((existing) => existing.song.id === item.songId)
      )
    ) {
      throw new AppError(
        "A escala destino ja possui uma ou mais musicas do repertorio origem.",
        409,
        "SCHEDULE_SONG_DUPLICATED"
      );
    }

    await scheduleSongRepository.copy(
      scheduleId,
      input.sourceScheduleId,
      input.mode,
      authorization.user.id
    );

    return buildRepertoire(scheduleId, destination.ministry.id);
  }
};
