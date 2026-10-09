import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  scheduleMemberCountLabel,
  summarizeScheduleMembers
} from "../src/lib/schedule-member-summary";

let scenarios = 0;

function test(name: string, run: () => void) {
  run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

async function main() {
  const source = await readFile("src/components/schedules/ScheduleMemberNames.tsx", "utf8");
  const componentSource = source.slice(source.indexOf("export function ScheduleMemberNames"));
  const rootClassName = componentSource.match(/return \(\s*<div className="([^"]+)">/)?.[1] ?? "";

  test("root estabelece containing block local", () => {
    assert.match(rootClassName, /(?:^|\s)relative(?:\s|$)/);
  });
  test("root preserva limites de largura existentes", () => {
    assert.match(rootClassName, /(?:^|\s)min-w-44(?:\s|$)/);
    assert.match(rootClassName, /(?:^|\s)max-w-xs(?:\s|$)/);
  });
  test("contador acessivel continua presente", () => {
    assert.match(source, /<span className="sr-only">\{scheduleMemberCountLabel\(memberCount\)\}<\/span>/);
  });
  test("sr-only nao e ocultado semanticamente", () => {
    assert.doesNotMatch(source, /aria-hidden/);
    assert.doesNotMatch(source, /display:\s*none|visibility:\s*hidden/);
  });
  test("contador preserva singular e plural", () => {
    assert.equal(scheduleMemberCountLabel(1), "1 membro");
    assert.equal(scheduleMemberCountLabel(4), "4 membros");
  });
  test("resumo preserva nomes e membros restantes", () => {
    const members = ["Ana", "Bruno", "Carla", "Daniel"].map((displayName, index) => ({
      id: String(index),
      member: { id: `member-${index}`, name: displayName, displayName }
    }));
    assert.deepEqual(summarizeScheduleMembers(members, 3), {
      names: ["Ana", "Bruno", "Carla"],
      remaining: 1,
      remainingLabel: "+1 membro"
    });
  });

  assert.equal(scenarios, 6, "A suite estrutural deve manter seis cenarios.");
  console.log(`Schedule member names overflow: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule member names overflow tests failed.");
  process.exitCode = 1;
});
