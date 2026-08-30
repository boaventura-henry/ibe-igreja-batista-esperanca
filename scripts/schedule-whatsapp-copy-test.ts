import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildScheduleWhatsAppMessage, copyScheduleWhatsAppText, type ClipboardRuntime, type ScheduleWhatsAppSong } from "../src/lib/schedule-whatsapp-copy";

let scenarios = 0;
async function test(name: string, run: () => void | Promise<void>) {
  await run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

const songs: ScheduleWhatsAppSong[] = [
  { performanceKey: "G", youtubeUrlOverride: null, song: { title: "Grande e o Senhor", youtubeUrl: "https://youtube.test/grande" }, leadMember: { name: "Mírian" } },
  { performanceKey: null, youtubeUrlOverride: "https://youtube.test/override", song: { title: "Bondade de Deus", youtubeUrl: null }, leadMember: null }
];

type FallbackInspection = {
  appendedText: string;
  attached: boolean;
  focused: boolean;
  selected: boolean;
  selectionRange: [number, number] | null;
  previousFocusRestored: number;
};

async function withBrowserFallback(
  clipboard: { writeText: (text: string) => Promise<void> } | undefined,
  execCommand: () => boolean,
  run: (inspection: FallbackInspection) => Promise<void>
) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const inspection: FallbackInspection = { appendedText: "", attached: false, focused: false, selected: false, selectionRange: null, previousFocusRestored: 0 };
  const previousFocus = { focus: () => { inspection.previousFocusRestored += 1; } };
  const textarea = {
    value: "",
    tabIndex: 0,
    style: {} as Record<string, string>,
    setAttribute: () => undefined,
    focus: () => { inspection.focused = true; },
    select: () => { inspection.selected = true; },
    setSelectionRange: (start: number, end: number) => { inspection.selectionRange = [start, end]; },
    remove: () => { inspection.attached = false; }
  };
  const fakeDocument = {
    activeElement: previousFocus,
    createElement: (tag: string) => {
      assert.equal(tag, "textarea");
      return textarea;
    },
    body: {
      appendChild: () => {
        inspection.appendedText = textarea.value;
        inspection.attached = true;
      }
    },
    execCommand: (command: string) => {
      assert.equal(command, "copy");
      return execCommand();
    }
  };

  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: clipboard ? { clipboard } : {} });
  try {
    await run(inspection);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete (globalThis as { document?: unknown }).document;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
}

async function main() {
await test("mensagem preserva escala, musicas, tom, ministro, link e quebras de linha", () => {
  assert.equal(buildScheduleWhatsAppMessage("Culto de Domingo", songs), "Escala de Culto de Domingo\n\n1. Grande e o Senhor - G\n   Ministro: Mírian\n   Referencia: https://youtube.test/grande\n2. Bondade de Deus\n   Referencia: https://youtube.test/override");
});
await test("campos opcionais ausentes nao criam blocos vazios", () => {
  assert.equal(buildScheduleWhatsAppMessage("Simples", [{ performanceKey: null, youtubeUrlOverride: null, song: { title: "Aleluia", youtubeUrl: null }, leadMember: null }]), "Escala de Simples\n\n1. Aleluia");
});
await test("Clipboard API recebe exatamente o texto gerado", async () => {
  let received = "";
  const runtime: ClipboardRuntime = { writeText: async (text) => { received = text; }, fallbackCopy: () => false };
  const text = buildScheduleWhatsAppMessage("Culto", songs);
  assert.equal(await copyScheduleWhatsAppText(text, runtime), true);
  assert.equal(received, text);
});
await test("falha da Clipboard API usa fallback real", async () => {
  await withBrowserFallback({ writeText: async () => { throw new Error("denied"); } }, () => true, async (inspection) => {
    assert.equal(await copyScheduleWhatsAppText("mensagem"), true);
    assert.equal(inspection.appendedText, "mensagem");
    assert.equal(inspection.attached, false);
  });
});
await test("falha dos dois mecanismos nao produz sucesso falso", async () => {
  const runtime: ClipboardRuntime = { writeText: async () => { throw new Error("denied"); }, fallbackCopy: () => false };
  assert.equal(await copyScheduleWhatsAppText("mensagem", runtime), false);
});
await test("conteudo vazio nao chama Clipboard API nem fallback", async () => {
  let calls = 0;
  const runtime: ClipboardRuntime = { writeText: async () => { calls += 1; }, fallbackCopy: () => { calls += 1; return true; } };
  assert.equal(await copyScheduleWhatsAppText("   ", runtime), false);
  assert.equal(calls, 0);
});
await test("Clipboard API indisponivel executa fallback diretamente", async () => {
  await withBrowserFallback(undefined, () => true, async (inspection) => {
    assert.equal(await copyScheduleWhatsAppText("mensagem sem clipboard"), true);
    assert.equal(inspection.appendedText, "mensagem sem clipboard");
    assert.equal(inspection.focused, true);
    assert.equal(inspection.selected, true);
    assert.deepEqual(inspection.selectionRange, [0, 22]);
    assert.equal(inspection.attached, false);
    assert.equal(inspection.previousFocusRestored, 1);
  });
});
await test("execCommand false e tratado como falha e limpa o DOM", async () => {
  await withBrowserFallback(undefined, () => false, async (inspection) => {
    assert.equal(await copyScheduleWhatsAppText("mensagem"), false);
    assert.equal(inspection.attached, false);
    assert.equal(inspection.previousFocusRestored, 1);
  });
});
await test("excecao do execCommand nao escapa e limpa o DOM", async () => {
  await withBrowserFallback(undefined, () => { throw new Error("copy unavailable"); }, async (inspection) => {
    assert.equal(await copyScheduleWhatsAppText("mensagem"), false);
    assert.equal(inspection.attached, false);
    assert.equal(inspection.previousFocusRestored, 1);
  });
});
await test("excecao inesperada do fallback nao gera rejeicao nao tratada", async () => {
  const runtime: ClipboardRuntime = { fallbackCopy: () => { throw new Error("fallback unavailable"); } };
  assert.equal(await copyScheduleWhatsAppText("mensagem", runtime), false);
});
await test("cliques sequenciais continuam copiando sem concatenar conteudo", async () => {
  const received: string[] = [];
  const runtime: ClipboardRuntime = { writeText: async (text) => { received.push(text); }, fallbackCopy: () => false };
  await copyScheduleWhatsAppText("primeira", runtime);
  await copyScheduleWhatsAppText("segunda", runtime);
  assert.deepEqual(received, ["primeira", "segunda"]);
});
await test("nova tentativa funciona depois de uma falha total", async () => {
  let shouldFail = true;
  const received: string[] = [];
  const runtime: ClipboardRuntime = {
    writeText: async (text) => {
      if (shouldFail) throw new Error("denied");
      received.push(text);
    },
    fallbackCopy: () => false
  };
  assert.equal(await copyScheduleWhatsAppText("primeira", runtime), false);
  shouldFail = false;
  assert.equal(await copyScheduleWhatsAppText("segunda", runtime), true);
  assert.deepEqual(received, ["segunda"]);
});
await test("componente usa helper, feedback acessivel e nenhum prompt", async () => {
  const source = await readFile(new URL("../src/components/schedules/ScheduleRepertoireManager.tsx", import.meta.url), "utf8");
  assert.match(source, /buildScheduleWhatsAppMessage\(scheduleTitle, data\.songs\)/);
  assert.match(source, /copyScheduleWhatsAppText\(text\)/);
  assert.match(source, /Repertorio copiado para o WhatsApp\./);
  assert.match(source, /Nao foi possivel copiar o repertorio\. Tente novamente\./);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /<button type="button"[^>]*onClick=\{\(\) => \{ void copy\(\); \}\}/);
  assert.match(source, /Aguarde o repertorio carregar para copiar a mensagem\./);
  assert.match(source, /Adicione uma musica ao repertorio antes de copiar a mensagem\./);
  assert.match(source, /disabled=\{isCopying\}/);
  assert.match(source, /isCopying \? "Copiando\.\.\." : "Copiar para WhatsApp"/);
  assert.match(source, /if \(copyInProgressRef\.current\) return;/);
  assert.match(source, /copyInProgressRef\.current = true;/);
  assert.match(source, /finally \{\s*copyInProgressRef\.current = false;\s*setIsCopying\(false\);/);
  assert.doesNotMatch(source, /window\.prompt|ScheduleMember\.role|scheduleMember\.role/);
});
await test("regressao de multiplas funcoes permanece baseada em roles", async () => {
  const portalTest = await readFile(new URL("./portal-multiple-schedule-roles-test.ts", import.meta.url), "utf8");
  const roleHelper = await readFile(new URL("../src/lib/schedule-member-role.ts", import.meta.url), "utf8");
  assert.match(portalTest, /roles/);
  assert.doesNotMatch(roleHelper, /ScheduleMember\.role|scheduleMember\.role/);
});

console.log(`Schedule WhatsApp copy: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule WhatsApp copy tests failed.");
  process.exitCode = 1;
});
