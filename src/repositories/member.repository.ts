import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { MemberCreateInput, MemberListQueryInput, MemberUpdateInput } from "@/validators";

const memberListSelect = {
  id: true,
  name: true,
  nickname: true,
  cpf: true,
  email: true,
  phone: true,
  mobilePhone: true,
  city: true,
  state: true,
  status: true,
  photoUrl: true,
  updatedAt: true,
  memberMinistries: {
    where: {
      deletedAt: null,
      status: "ACTIVE"
    },
    select: {
      ministry: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      ministry: {
        name: "asc"
      }
    }
  }
} satisfies Prisma.MemberSelect;

const memberDetailSelect = {
  id: true,
  name: true,
  nickname: true,
  cpf: true,
  rg: true,
  birthDate: true,
  sex: true,
  maritalStatus: true,
  phone: true,
  mobilePhone: true,
  whatsapp: true,
  email: true,
  zipCode: true,
  street: true,
  number: true,
  complement: true,
  district: true,
  city: true,
  state: true,
  baptismDate: true,
  joinedAt: true,
  status: true,
  notes: true,
  photoUrl: true,
  user: {
    select: {
      id: true,
      email: true,
      isActive: true,
      lockedUntil: true,
      accessRole: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  memberMinistries: {
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      role: true,
      status: true,
      entryDate: true,
      exitDate: true,
      observations: true,
      ministry: {
        select: {
          id: true,
          name: true,
          description: true
        }
      }
    },
    orderBy: {
      entryDate: "desc"
    }
  },
  scheduleMembers: {
    where: {
      deletedAt: null,
      schedule: {
        deletedAt: null
      }
    },
    select: {
      id: true,
      role: true,
      status: true,
      confirmedAt: true,
      declinedAt: true,
      declineReason: true,
      schedule: {
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          status: true,
          ministry: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      schedule: {
        date: "desc"
      }
    },
    take: 12
  },
  donations: {
    select: {
      id: true,
      amount: true,
      type: true,
      donatedAt: true,
      notes: true
    },
    orderBy: {
      donatedAt: "desc"
    },
    take: 10
  }
} satisfies Prisma.MemberSelect;

export type MemberListItem = Prisma.MemberGetPayload<{ select: typeof memberListSelect }>;
export type MemberDetail = Prisma.MemberGetPayload<{ select: typeof memberDetailSelect }>;

function dateOrNull(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function baseMemberData(data: MemberCreateInput | MemberUpdateInput) {
  return {
    name: data.name,
    nickname: data.nickname,
    cpf: data.cpf,
    rg: data.rg,
    birthDate: dateOrNull(data.birthDate),
    sex: data.sex,
    maritalStatus: data.maritalStatus,
    phone: data.phone,
    mobilePhone: data.mobilePhone,
    whatsapp: data.whatsapp,
    email: data.email,
    zipCode: data.zipCode,
    street: data.street,
    number: data.number,
    complement: data.complement,
    district: data.district,
    city: data.city,
    state: data.state,
    baptismDate: dateOrNull(data.baptismDate),
    joinedAt: dateOrNull(data.joinedAt),
    status: data.status,
    notes: data.notes,
    photoUrl: data.photoUrl
  };
}

function createMemberData(data: MemberCreateInput): Prisma.MemberCreateInput {
  return {
    ...baseMemberData(data),
    name: data.name,
    cpf: data.cpf,
    sex: data.sex,
    status: data.status
  };
}

function updateMemberData(data: MemberUpdateInput): Prisma.MemberUpdateInput {
  return baseMemberData(data);
}

function buildWhere(filters: MemberListQueryInput): Prisma.MemberWhereInput {
  const and: Prisma.MemberWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { nickname: { contains: filters.search, mode: "insensitive" } },
        { cpf: { contains: filters.search } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { city: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  if (filters.name) {
    and.push({ OR: [{ name: { contains: filters.name, mode: "insensitive" } }, { nickname: { contains: filters.name, mode: "insensitive" } }] });
  }

  if (filters.cpf) {
    and.push({ cpf: { contains: filters.cpf } });
  }

  if (filters.city) {
    and.push({ city: { contains: filters.city, mode: "insensitive" } });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.ministryId) {
    and.push({
      memberMinistries: {
        some: {
          ministryId: filters.ministryId,
          status: "ACTIVE",
          deletedAt: null
        }
      }
    });
  }

  return { AND: and };
}

export const memberRepository = {
  async list(filters: MemberListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = {
      [filters.sortBy]: filters.sortOrder
    } satisfies Prisma.MemberOrderByWithRelationInput;

    const [members, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
        select: memberListSelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.member.count({ where })
    ]);

    return { members, total };
  },

  findById(id: string) {
    return prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: memberDetailSelect
    });
  },

  findByCpf(cpf: string) {
    return prisma.member.findUnique({
      where: { cpf },
      select: { id: true }
    });
  },

  findByEmail(email: string) {
    return prisma.member.findUnique({
      where: { email },
      select: { id: true }
    });
  },

  create(data: MemberCreateInput, userId: string) {
    return prisma.member.create({
      data: {
        ...createMemberData(data),
        createdBy: { connect: { id: userId } },
        updatedBy: { connect: { id: userId } }
      },
      select: memberDetailSelect
    });
  },

  update(id: string, data: MemberUpdateInput, userId: string) {
    return prisma.member.update({
      where: { id },
      data: {
        ...updateMemberData(data),
        updatedBy: { connect: { id: userId } }
      },
      select: memberDetailSelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.member.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: userId
      },
      select: {
        id: true,
        deletedAt: true
      }
    });
  },

  listMinistries() {
    return prisma.ministry.findMany({
      where: {
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        displayOrder: "asc"
      }
    });
  }
};
