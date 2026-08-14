import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [instrumentRepository, categoryRoute, manager, detail, forms] = await Promise.all([
    readFile("src/repositories/instrument.repository.ts", "utf8"),
    readFile("src/app/api/instrument-categories/route.ts", "utf8"),
    readFile("src/components/instruments/InstrumentManager.tsx", "utf8"),
    readFile("src/components/instruments/InstrumentDetail.tsx", "utf8"),
    readFile("src/components/instruments/InstrumentForms.tsx", "utf8")
  ]);

  assert.match(instrumentRepository, /categoryId:true/, "A projecao precisa devolver categoryId para edicao.");
  assert.match(categoryRoute, /requireAnyPermission\(\["instrument\.view","instrument\.create","instrument\.update","instrument\.category\.manage"\]\)/, "Categorias precisam estar disponiveis para visualizacao e formularios autorizados.");
  assert.match(manager, /categoryId:\s*string/, "A lista precisa preservar categoryId ao abrir edicao.");
  assert.match(detail, /categoryId:\s*string/, "Os detalhes precisam preservar categoryId ao abrir edicao.");
  assert.match(detail, /relatedInstrumentId\?\s*:\s*string\s*\|\s*null/, "A edicao do historico precisa receber o instrumento relacionado.");
  assert.match(detail, /Historico atualizado com sucesso\./, "A edicao de historico precisa confirmar o sucesso.");
  assert.match(forms, /method:\s*historyId\s*\?\s*"PUT"\s*:\s*"POST"/, "HistoryForm precisa usar PUT na edicao e POST na criacao.");
  assert.match(forms, /relatedInstrumentId:\s*form\.type\s*===\s*"REPLACEMENT"\s*\?\s*form\.relatedInstrumentId\s*:\s*undefined/, "HistoryForm precisa limpar o vinculo fora de substituicao.");
  console.log("Instrument admin UI contract tests passed: 8 scenarios.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });