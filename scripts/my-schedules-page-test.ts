import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AppError } from "../src/lib/errors";
import { loadMySchedulesPageData } from "../src/lib/my-schedules-page";
import { myScheduleService } from "../src/services/my-schedule.service";

async function main() {
  let scenarios = 0;

  const test = async (name: string, run: () => Promise<void> | void) => {
    await run();
    scenarios += 1;
    console.log(`PASS ${scenarios}: ${name}`);
  };

  await test("usuario com memberId recebe a listagem normalmente", async () => {
    const expected = { schedules: [] };
    const result = await loadMySchedulesPageData(
      { id: "user-member", memberId: "member-1" },
      async () => expected
    );

    assert.deepEqual(result, { kind: "ready", data: expected });
  });

  await test("usuario sem memberId reproduz o erro 403 do service", async () => {
    await assert.rejects(
      () => myScheduleService.list({ id: "user-without-member", memberId: null }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 403 &&
        error.code === "USER_WITHOUT_MEMBER"
    );
  });

  await test("pagina converte somente USER_WITHOUT_MEMBER em estado amigavel", async () => {
    const result = await loadMySchedulesPageData(
      { id: "user-without-member", memberId: null },
      myScheduleService.list
    );

    assert.deepEqual(result, { kind: "member-link-required" });
    assert(!("data" in result));
  });

  await test("erro estrutural continua sendo propagado", async () => {
    const structuralError = new Error("database unavailable");

    await assert.rejects(
      () =>
        loadMySchedulesPageData(
          { id: "user-member", memberId: "member-1" },
          async () => {
            throw structuralError;
          }
        ),
      (error: unknown) => error === structuralError
    );
  });

  await test("outro erro 403 nao e convertido em estado vazio", async () => {
    await assert.rejects(
      () =>
        loadMySchedulesPageData(
          { id: "user-member", memberId: "member-1" },
          async () => {
            throw new AppError("Acesso negado.", 403, "FORBIDDEN");
          }
        ),
      (error: unknown) => error instanceof AppError && error.code === "FORBIDDEN"
    );
  });

  await test("pagina preserva autenticacao, mensagem e ausencia de acoes", () => {
    const page = readFileSync("src/app/(app)/minhas-escalas/page.tsx", "utf8");

    assert(page.includes('requirePermission("mySchedule.view")'));
    assert(page.includes("Entre em contato com a administracao"));
    assert(page.includes('result.kind === "member-link-required"'));
    assert(!page.includes("USER_WITHOUT_MEMBER</"));
  });

  await test("API preserva resposta AppError e status 403 do dominio", () => {
    const route = readFileSync("src/app/api/my-schedules/route.ts", "utf8");
    const service = readFileSync("src/services/my-schedule.service.ts", "utf8");

    assert(route.includes("apiError(error.message, error.statusCode, error.code)"));
    assert(service.includes('403, "USER_WITHOUT_MEMBER"'));
  });

  await test("filtros e isolamento pelo membro da sessao permanecem", () => {
    const manager = readFileSync(
      "src/components/my-schedules/MyScheduleManager.tsx",
      "utf8"
    );
    const repository = readFileSync(
      "src/repositories/my-schedule.repository.ts",
      "utf8"
    );

    assert(manager.includes("includeCompleted"));
    assert(repository.includes("listByMemberId"));
    assert(repository.includes("memberId"));
    assert(repository.includes("replacedByMember"));
  });

  console.log(`My Schedules page: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "My Schedules page tests failed."
  );
  process.exitCode = 1;
});
