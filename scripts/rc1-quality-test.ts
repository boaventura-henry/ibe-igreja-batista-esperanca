import assert from "node:assert/strict";
import { AppError, toAppError } from "../src/lib/errors";
import { MAX_IMAGE_UPLOAD_SIZE, validateImageUpload } from "../src/lib/image-upload";
import { hasPermission } from "../src/lib/permissions";
import { isSafeExternalUrl } from "../src/utils/url";
import {
  announcementCreateSchema,
  eventCreateSchema,
  memberCreateSchema,
  ministryCreateSchema
} from "../src/validators";

type Scenario = { name: string; run: () => void | Promise<void> };

const baseAnnouncement = {
  title: "Aviso",
  content: "Conteudo",
  status: "DRAFT",
  audience: "ALL",
  isPinned: false
} as const;

const baseEvent = {
  title: "Evento",
  type: "OTHER",
  status: "DRAFT",
  startDate: "2026-07-21",
  requiresRegistration: false,
  isPublic: false
} as const;

const baseMember = { name: "Pessoa de Teste" };
const baseMinistry = { name: "Ministerio", color: "#2563eb", icon: "USERS", isActive: true } as const;

const scenarios: Scenario[] = [
  { name: "URL HTTPS aceita", run: () => assert.equal(isSafeExternalUrl("https://example.com/a"), true) },
  { name: "URL HTTP aceita", run: () => assert.equal(isSafeExternalUrl("http://example.com"), true) },
  { name: "javascript rejeitado", run: () => assert.equal(isSafeExternalUrl("javascript:alert(1)"), false) },
  { name: "data URL rejeitada", run: () => assert.equal(isSafeExternalUrl("data:text/html,test"), false) },
  { name: "URL relativa rejeitada", run: () => assert.equal(isSafeExternalUrl("/interno"), false) },
  { name: "link de comunicado seguro aceito", run: () => assert.equal(announcementCreateSchema.safeParse({ ...baseAnnouncement, externalLink: "https://example.com" }).success, true) },
  { name: "link de comunicado inseguro rejeitado", run: () => assert.equal(announcementCreateSchema.safeParse({ ...baseAnnouncement, externalLink: "javascript:alert(1)" }).success, false) },
  { name: "imagem de evento insegura rejeitada", run: () => assert.equal(eventCreateSchema.safeParse({ ...baseEvent, imageUrl: "file:///tmp/a" }).success, false) },
  { name: "foto de membro insegura rejeitada", run: () => assert.equal(memberCreateSchema.safeParse({ ...baseMember, photoUrl: "data:image/png;base64,AA==" }).success, false) },
  { name: "imagem de ministerio segura aceita", run: () => assert.equal(ministryCreateSchema.safeParse({ ...baseMinistry, imageUrl: "https://example.com/a.webp" }).success, true) },
  { name: "JPEG detectado pelo conteudo", run: async () => assert.deepEqual(await validateImageUpload(new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "falso.exe", { type: "application/octet-stream" })), { contentType: "image/jpeg", extension: "jpg" }) },
  { name: "PNG detectado pelo conteudo", run: async () => assert.deepEqual(await validateImageUpload(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "imagem.txt")), { contentType: "image/png", extension: "png" }) },
  { name: "WebP detectado pelo conteudo", run: async () => assert.deepEqual(await validateImageUpload(new File([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], "imagem.bin")), { contentType: "image/webp", extension: "webp" }) },
  { name: "arquivo vazio rejeitado", run: async () => assert.rejects(() => validateImageUpload(new File([], "vazio.png")), (error: unknown) => error instanceof AppError && error.code === "INVALID_FILE") },
  { name: "conteudo forjado rejeitado", run: async () => assert.rejects(() => validateImageUpload(new File(["nao e imagem"], "falso.jpg", { type: "image/jpeg" })), (error: unknown) => error instanceof AppError && error.code === "INVALID_FILE_TYPE") },
  { name: "arquivo acima de 4 MB rejeitado", run: async () => assert.rejects(() => validateImageUpload(new File([new Uint8Array(MAX_IMAGE_UPLOAD_SIZE + 1)], "grande.png")), (error: unknown) => error instanceof AppError && error.code === "FILE_TOO_LARGE") },
  { name: "erro desconhecido e sanitizado", run: () => assert.deepEqual({ message: toAppError(new Error("segredo SQL")).message, code: toAppError(new Error("segredo SQL")).code }, { message: "Unexpected application error", code: "INTERNAL_ERROR" }) },
  { name: "AppError preserva mensagem controlada", run: () => assert.equal(toAppError(new AppError("controlado", 409, "CONTROLLED")).code, "CONTROLLED") },
  { name: "permissao presente aceita", run: () => assert.equal(hasPermission({ permissions: [], permissionCodes: ["member.view"] }, "member.view"), true) },
  { name: "permissao ausente rejeita", run: () => assert.equal(hasPermission({ permissions: [], permissionCodes: [] }, "member.view"), false) }
];

async function main() {
  let passed = 0;

  for (const scenario of scenarios) {
    await scenario.run();
    passed += 1;
    console.log(`PASS ${passed.toString().padStart(2, "0")} - ${scenario.name}`);
  }

  console.log(`RC1 quality scenarios: ${passed}/${scenarios.length} passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
