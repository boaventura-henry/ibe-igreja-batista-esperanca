import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { availablePermissions } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { instrumentHistoryService, instrumentService } from "@/services";
import { instrumentHistoryCreateSchema } from "@/validators";

const prisma = new PrismaClient();
const prefix = "__instrument_domain_test__";
const stamp = Date.now().toString();
const name = (value: string) => prefix + stamp + "_" + value;
const expectAppError = async (action: () => Promise<unknown>, code: string) => {
  await assert.rejects(action, (error: unknown) => error instanceof AppError && error.code === code);
};

async function main() {
  const user = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(user, "O seed deve disponibilizar um usuario para a auditoria de instrumentos.");
  let categoryA = ""; let categoryInactive = ""; let ministryActive = ""; let ministryInactive = ""; let instrumentA = ""; let instrumentB = "";
  try {
    const [active, inactive, activeMinistry, inactiveMinistry] = await prisma.$transaction([
      prisma.instrumentCategory.create({ data: { name: name("categoria_ativa") } }),
      prisma.instrumentCategory.create({ data: { name: name("categoria_inativa"), isActive: false } }),
      prisma.ministry.create({ data: { name: name("ministerio_ativo"), slug: name("ministerio_ativo").toLowerCase() } }),
      prisma.ministry.create({ data: { name: name("ministerio_inativo"), slug: name("ministerio_inativo").toLowerCase(), isActive: false } })
    ]);
    categoryA = active.id; categoryInactive = inactive.id; ministryActive = activeMinistry.id; ministryInactive = inactiveMinistry.id;
    const first = await instrumentService.create({ name: "Instrumento de teste", categoryId: categoryA, ministryId: ministryActive, serialNumber: name("serie"), assetNumber: name("patrimonio"), acquisitionValue: 1234.56, status: "ACTIVE" }, user.id);
    instrumentA = first.id;
    const second = await instrumentService.create({ name: "Instrumento de teste", categoryId: categoryA, status: "ACTIVE" }, user.id);
    instrumentB = second.id;
    assert.equal(first.name, second.name, "Nomes duplicados devem ser permitidos.");
    await expectAppError(() => instrumentService.create({ name: "Duplicado", categoryId: categoryA, serialNumber: name("serie"), status: "ACTIVE" }, user.id), "INSTRUMENT_SERIAL_NUMBER_DUPLICATE");
    await expectAppError(() => instrumentService.create({ name: "Categoria inativa", categoryId: categoryInactive, status: "ACTIVE" }, user.id), "INSTRUMENT_CATEGORY_INACTIVE");
    await expectAppError(() => instrumentService.create({ name: "Ministerio inativo", categoryId: categoryA, ministryId: ministryInactive, status: "ACTIVE" }, user.id), "INSTRUMENT_MINISTRY_INVALID");
    const maintenance = instrumentHistoryCreateSchema.parse({ type: "MAINTENANCE", occurredAt: new Date(), description: "Revisao", cost: 25.5 });
    await instrumentHistoryService.create(instrumentA, maintenance, user.id);
    const replacement = instrumentHistoryCreateSchema.parse({ type: "REPLACEMENT", occurredAt: new Date(), description: "Substituicao", relatedInstrumentId: instrumentB });
    const replacementHistory = await instrumentHistoryService.create(instrumentA, replacement, user.id);
    await instrumentHistoryService.update(replacementHistory.id, { type: "MAINTENANCE", relatedInstrumentId: undefined }, user.id);
    const maintenanceHistory = await instrumentHistoryService.getById(replacementHistory.id);
    assert.equal(maintenanceHistory.relatedInstrumentId, null, "A troca para manutencao deve limpar o instrumento relacionado.");
    await instrumentHistoryService.update(replacementHistory.id, { type: "OTHER", relatedInstrumentId: undefined }, user.id);
    const otherHistory = await instrumentHistoryService.getById(replacementHistory.id);
    assert.equal(otherHistory.relatedInstrumentId, null, "A troca para ocorrencia deve manter o instrumento relacionado limpo.");
    await instrumentHistoryService.update(replacementHistory.id, { type: "REPLACEMENT", relatedInstrumentId: instrumentB }, user.id);
    await expectAppError(() => instrumentHistoryService.create(instrumentA, { ...replacement, relatedInstrumentId: instrumentA }, user.id), "INSTRUMENT_HISTORY_SELF_REFERENCE");
    assert.throws(() => instrumentHistoryCreateSchema.parse({ type: "REPLACEMENT", occurredAt: new Date(), description: "Sem destino" }));
    const current = await prisma.instrument.findUniqueOrThrow({ where: { id: instrumentA }, select: { status: true } });
    assert.equal(current.status, "ACTIVE", "Historico de manutencao nao pode alterar o status atual.");
    await instrumentService.remove(instrumentA, user.id);
    assert.equal(await prisma.instrumentHistory.count({ where: { instrumentId: instrumentA } }), 2, "Soft delete deve preservar o historico.");
    await expectAppError(() => instrumentHistoryService.create(instrumentA, maintenance, user.id), "INSTRUMENT_NOT_FOUND");
    for (const code of ["instrument.view", "instrument.create", "instrument.update", "instrument.delete", "instrument.history.view", "instrument.history.create", "instrument.history.update", "instrument.category.manage"]) assert.ok(availablePermissions.some((permission) => permission.code === code), "Permissao ausente: " + code);
    console.log("Instrument domain tests passed: 20 scenarios.");
  } finally {
    await prisma.instrumentHistory.deleteMany({ where: { OR: [{ instrumentId: instrumentA || "__none__" }, { relatedInstrumentId: instrumentB || "__none__" }] } });
    await prisma.instrument.deleteMany({ where: { id: { in: [instrumentA, instrumentB].filter(Boolean) } } });
    await prisma.instrumentCategory.deleteMany({ where: { id: { in: [categoryA, categoryInactive].filter(Boolean) } } });
    await prisma.ministry.deleteMany({ where: { id: { in: [ministryActive, ministryInactive].filter(Boolean) } } });
    await prisma.$disconnect();
  }
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
