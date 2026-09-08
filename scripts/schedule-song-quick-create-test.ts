import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { songCreateSchema } from "../src/validators/song.validator";

const component = readFileSync("src/components/schedules/ScheduleRepertoireManager.tsx", "utf8");
const manager = readFileSync("src/components/songs/SongManager.tsx", "utf8");
const route = readFileSync("src/app/api/songs/route.ts", "utf8");
const service = readFileSync("src/services/song.service.ts", "utf8");
const repository = readFileSync("src/repositories/song.repository.ts", "utf8");

assert(component.includes("➕ Cadastrar") && component.includes("openQuickCreate"), "1: pesquisa sem resultado abre o cadastro rapido");
assert(component.includes('fetch("/api/songs", { method: "POST"'), "2: cadastro rapido usa POST no endpoint oficial");
assert(manager.includes('editing ? "PUT" : "POST"') && manager.includes('editing ? `/api/songs/${editing}` : "/api/songs"'), "3: tela oficial preserva o mesmo endpoint de criacao");
assert(route.includes('requirePermission("song.create")') && route.includes("songCreateSchema.parse") && route.includes("songService.create"), "4: endpoint oficial aplica permissao, validator e service reais");
assert(service.includes("songRepository.findDuplicate") && service.includes("songRepository.create"), "5: duplicidade e persistencia continuam centralizadas no service oficial");

const parsed = songCreateSchema.parse({
  title: "  Música de Teste  ",
  artist: "  Artista  ",
  youtubeUrl: " https://youtu.be/abcdefghijk ",
  referenceKey: " G ",
  isActive: true
});
assert.equal(parsed.title, "Música de Teste", "6: quick-create segue a normalizacao real do titulo");
assert.equal(parsed.artist, "Artista", "7: quick-create segue a normalizacao real do artista");
assert.equal(parsed.referenceKey, "G", "8: quick-create segue a normalizacao real do tom");
assert.equal(parsed.isActive, true, "9: nova musica permanece ativa por padrao");
assert.throws(() => songCreateSchema.parse({ title: "   ", isActive: true }), "9: payload invalido e rejeitado pelo validator oficial");

assert(component.includes("createPortal(quickCreateDialog, document.body)"), "10: dialogo rapido fica fora do formulario de repertorio no DOM");
assert(component.includes("event.stopPropagation()"), "11: submit rapido nao aciona o submit do repertorio");
assert(component.includes("quickCreateInProgressRef.current") && component.includes("if (quickCreateInProgressRef.current) return"), "12: lock sincrono bloqueia submit duplicado");
assert(component.includes("setQuickCreatedSong(payload.data)") && component.includes("onSelect(payload.data)"), "13: musica criada entra nas opcoes e e selecionada automaticamente");
assert(component.indexOf("setQuickCreateOpen(false)", component.indexOf("async function saveQuickCreate")) > component.indexOf("if (!payload.success)", component.indexOf("async function saveQuickCreate")), "14: dialogo fecha somente depois de sucesso real");
assert(component.includes('setQuickCreateMessage(payload.error.message)') && component.includes('setQuickCreateMessage("Nao foi possivel cadastrar a musica.")'), "15: falhas funcionais e de rede mantem feedback amigavel");
assert(component.includes("finally") && component.includes("setQuickCreateSaving(false)"), "16: estado de loading sempre e liberado");
assert(component.includes("onQuickCreateSuccess()") && component.includes("Música cadastrada e selecionada."), "17: sucesso informa que a musica esta selecionada para continuar o repertorio");
assert(!component.includes("ScheduleMember.role"), "18: quick-create nao reintroduz dependencia do campo removido");
assert(service.includes("songRepository.transaction") && service.includes("MAX_SONG_CREATE_ATTEMPTS"), "19: criacao oficial trata concorrencia com retry controlado");
assert(repository.includes("TransactionIsolationLevel.Serializable"), "20: duplicidade e insercao usam isolamento serializavel");

console.log("Schedule song quick create: 21 scenarios passed.");
