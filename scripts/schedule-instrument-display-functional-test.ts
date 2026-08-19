import assert from "node:assert/strict";
import {
  InstrumentStatus,
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole
} from "@prisma/client";
import { getScheduleMemberDisplayRole } from "@/lib/schedule-member-role";

const prisma = new PrismaClient();
const prefix = `__schedule_instrument_display_${Date.now()}__`;

async function main() {
  const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(user, "Development requires an active user for the controlled display test.");

  const ids = {
    ministryId: "",
    scheduleId: "",
    categoryId: "",
    instrumentId: "",
    memberIds: [] as string[],
    participantIds: [] as string[]
  };

  try {
    const ministry = await prisma.ministry.create({
      data: { name: `${prefix}ministry`, slug: `${prefix}ministry` }
    });
    ids.ministryId = ministry.id;

    const schedule = await prisma.schedule.create({
      data: {
        title: `${prefix}schedule`,
        ministryId: ministry.id,
        date: new Date("2099-01-01"),
        createdById: user.id
      }
    });
    ids.scheduleId = schedule.id;

    const category = await prisma.instrumentCategory.create({ data: { name: "Baixo" } });
    ids.categoryId = category.id;
    const instrument = await prisma.instrument.create({
      data: { name: "Baixo Tagima Millennium Top 5", categoryId: category.id }
    });
    ids.instrumentId = instrument.id;

    const createParticipant = async (role: ScheduleMemberRole) => {
      const member = await prisma.member.create({ data: { name: `${prefix}${role}_${ids.memberIds.length}` } });
      ids.memberIds.push(member.id);
      const participant = await prisma.scheduleMember.create({
        data: { scheduleId: schedule.id, memberId: member.id, role }
      });
      ids.participantIds.push(participant.id);
      return participant;
    };

    const registered = await createParticipant(ScheduleMemberRole.INSTRUMENT);
    await prisma.scheduleMemberInstrumentAssignment.create({
      data: {
        scheduleMemberId: registered.id,
        instrumentCategoryId: category.id,
        instrumentId: instrument.id,
        source: ScheduleInstrumentSource.REGISTERED,
        createdById: user.id
      }
    });

    const own = await createParticipant(ScheduleMemberRole.INSTRUMENT);
    await prisma.scheduleMemberInstrumentAssignment.create({
      data: {
        scheduleMemberId: own.id,
        instrumentCategoryId: category.id,
        source: ScheduleInstrumentSource.OWN,
        createdById: user.id
      }
    });

    const historical = await createParticipant(ScheduleMemberRole.INSTRUMENT);
    const vocal = await createParticipant(ScheduleMemberRole.VOCAL);

    const [registeredAssignment, ownAssignment] = await Promise.all([
      prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({
        where: { scheduleMemberId: registered.id, endedAt: null },
        include: { instrumentCategory: true }
      }),
      prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({
        where: { scheduleMemberId: own.id, endedAt: null },
        include: { instrumentCategory: true }
      })
    ]);

    assert.equal(getScheduleMemberDisplayRole(registered.role, registeredAssignment), "Baixo");
    assert.equal(getScheduleMemberDisplayRole(own.role, ownAssignment), "Baixo");
    assert.equal(getScheduleMemberDisplayRole(historical.role), "Instrumento");
    assert.equal(getScheduleMemberDisplayRole(vocal.role, registeredAssignment), "Vocal");

    await prisma.instrumentCategory.update({ where: { id: category.id }, data: { isActive: false } });
    await prisma.instrument.update({ where: { id: instrument.id }, data: { status: InstrumentStatus.MAINTENANCE } });
    assert.equal(getScheduleMemberDisplayRole(registered.role, registeredAssignment), "Baixo");

    await prisma.instrument.update({
      where: { id: instrument.id },
      data: { status: InstrumentStatus.INACTIVE, deletedAt: new Date() }
    });
    assert.equal(getScheduleMemberDisplayRole(registered.role, registeredAssignment), "Baixo");
    assert.notEqual(getScheduleMemberDisplayRole(registered.role, registeredAssignment), instrument.name);

    console.log("Schedule instrument display functional: 8 scenarios passed.");
  } finally {
    if (ids.participantIds.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({
        where: { scheduleMemberId: { in: ids.participantIds } }
      });
    }
    if (ids.scheduleId) await prisma.scheduleMember.deleteMany({ where: { scheduleId: ids.scheduleId } });
    if (ids.scheduleId) await prisma.schedule.deleteMany({ where: { id: ids.scheduleId } });
    if (ids.instrumentId) await prisma.instrument.deleteMany({ where: { id: ids.instrumentId } });
    if (ids.categoryId) await prisma.instrumentCategory.deleteMany({ where: { id: ids.categoryId } });
    if (ids.memberIds.length) await prisma.member.deleteMany({ where: { id: { in: ids.memberIds } } });
    if (ids.ministryId) await prisma.ministry.deleteMany({ where: { id: ids.ministryId } });
    await prisma.$disconnect();
  }
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});