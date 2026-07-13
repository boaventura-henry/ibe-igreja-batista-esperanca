import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { ministryRepository, type MinistryRecord } from "@/repositories";
import type { MinistryListResult, MinistrySummary } from "@/types";
import { createSlug } from "@/utils";
import type { MinistryCreateInput, MinistryListQueryInput, MinistryUpdateInput } from "@/validators";

function serialize(ministry: MinistryRecord): MinistrySummary {
  return {
    id: ministry.id,
    name: ministry.name,
    slug: ministry.slug,
    description: ministry.description,
    color: ministry.color,
    icon: ministry.icon,
    imageUrl: ministry.imageUrl,
    displayOrder: ministry.displayOrder,
    email: ministry.email,
    phone: ministry.phone,
    meetingDay: ministry.meetingDay,
    meetingTime: ministry.meetingTime,
    location: ministry.location,
    notes: ministry.notes,
    isActive: ministry.isActive,
    isSystem: ministry.isSystem,
    leaderMember: ministry.leaderMember,
    viceLeaderMember: ministry.viceLeaderMember,
    membersCount: ministry._count.memberMinistries,
    eventsCount: ministry._count.events,
    createdAt: ministry.createdAt.toISOString(),
    updatedAt: ministry.updatedAt.toISOString()
  };
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function ensureUniqueName(name: string | undefined, currentId?: string) {
  if (!name) {
    return;
  }

  const existing = await ministryRepository.findByName(name);

  if (existing && existing.id !== currentId) {
    throw new AppError("Ja existe um ministerio com este nome.", 409, "MINISTRY_NAME_EXISTS");
  }
}

async function createUniqueSlug(name: string, currentId?: string) {
  const baseSlug = createSlug(name);
  let slug = baseSlug || "ministerio";
  let suffix = 1;

  while (true) {
    const existing = await ministryRepository.findBySlug(slug);

    if (!existing || existing.id === currentId) {
      return slug;
    }

    slug = `${baseSlug || "ministerio"}-${suffix++}`;
  }
}

async function ensureDisplayOrderAvailable(
  displayOrder: number | undefined,
  isActive: boolean | undefined,
  currentId?: string
) {
  if (displayOrder === undefined || isActive === false) {
    return;
  }

  const existing = await ministryRepository.findActiveByDisplayOrder(displayOrder);

  if (existing && existing.id !== currentId) {
    throw new AppError("Já existe um ministério ativo com esta ordem. Informe outra ordem.", 409, "MINISTRY_DISPLAY_ORDER_EXISTS");
  }
}

function ensureDifferentLeaderIds(
  leaderMemberId: string | null | undefined,
  viceLeaderMemberId: string | null | undefined
) {
  if (leaderMemberId && viceLeaderMemberId && leaderMemberId === viceLeaderMemberId) {
    throw new AppError(
      "Lider e vice-lider nao podem ser a mesma pessoa.",
      400,
      "MINISTRY_LEADERS_MUST_DIFFER"
    );
  }
}

function ensureHexColor(color: string | undefined) {
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new AppError("Informe uma cor hexadecimal valida.", 400, "MINISTRY_INVALID_COLOR");
  }
}

export const ministryService = {
  async list(filters: MinistryListQueryInput): Promise<MinistryListResult> {
    const [result, members] = await Promise.all([
      ministryRepository.list(filters),
      ministryRepository.listMembers()
    ]);

    return {
      ministries: result.ministries.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: {
        members
      }
    };
  },

  async getById(id: string) {
    const ministry = await ministryRepository.findById(id);

    if (!ministry) {
      throw new AppError("Ministerio nao encontrado.", 404, "MINISTRY_NOT_FOUND");
    }

    return serialize(ministry);
  },

  async getNextDisplayOrder() {
    return { displayOrder: await ministryRepository.getNextDisplayOrder() };
  },

  async create(data: MinistryCreateInput, userId: string) {
    ensureHexColor(data.color);
    ensureDifferentLeaderIds(data.leaderMemberId, data.viceLeaderMemberId);
    await ensureUniqueName(data.name);
    const displayOrder = data.displayOrder ?? (await ministryRepository.getNextDisplayOrder());
    await ensureDisplayOrderAvailable(displayOrder, data.isActive);
    const slug = await createUniqueSlug(data.name);
    const createData = { ...data, displayOrder };

    try {
      return serialize(await ministryRepository.create(createData, userId, slug));
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("Ja existe um ministerio com este nome.", 409, "MINISTRY_NAME_EXISTS");
      }

      throw error;
    }
  },

  async update(id: string, data: MinistryUpdateInput, userId: string) {
    const current = await this.getById(id);
    ensureHexColor(data.color);
    const leaderMemberId =
      data.leaderMemberId === undefined ? current.leaderMember?.id ?? null : data.leaderMemberId;
    const viceLeaderMemberId =
      data.viceLeaderMemberId === undefined ? current.viceLeaderMember?.id ?? null : data.viceLeaderMemberId;

    ensureDifferentLeaderIds(leaderMemberId, viceLeaderMemberId);
    await ensureUniqueName(data.name, id);
    await ensureDisplayOrderAvailable(
      data.displayOrder === undefined ? current.displayOrder : data.displayOrder,
      data.isActive === undefined ? current.isActive : data.isActive,
      id
    );
    const nextData = data.name ? { ...data, slug: await createUniqueSlug(data.name, id) } : data;

    try {
      return serialize(await ministryRepository.update(id, nextData, userId));
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("Ja existe um ministerio com este nome.", 409, "MINISTRY_NAME_EXISTS");
      }

      throw error;
    }
  },

  async remove(id: string, userId: string) {
    const current = await this.getById(id);

    if (current.isSystem) {
      throw new AppError("Nao e permitido excluir um ministerio do sistema.", 409, "SYSTEM_MINISTRY_DELETE");
    }

    return ministryRepository.softDelete(id, userId);
  }
};
