import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

const consumers = [
  ["src/components/financial/FinancialEntryManager.tsx", ["Membro do lançamento"], 1],
  ["src/components/schedules/ScheduleDetailManager.tsx", ["Membro escalado", "Membro substituto"], 2],
  ["src/components/schedules/ScheduleRepertoireManager.tsx", ["Ministro da musica"], 1],
  ["src/components/member-ministries/MemberMinistryManager.tsx", ["Filtrar por membro", "Membro do vínculo"], 2],
  ["src/components/ministries/MinistryManager.tsx", ["Filtrar por liderança", "Líder do ministério", "Vice-líder do ministério"], 3],
  ["src/components/events/EventManager.tsx", ["Responsável pelo evento"], 1],
  ["src/components/users/UserManager.tsx", ["Membro vinculado"], 1],
  ["src/components/access-requests/AccessRequestManager.tsx", ["Membro aprovado"], 1]
] as const;

for (const [file, markers, expectedCount] of consumers) {
  const source = read(file);
  assert.match(source, /import \{ MemberCombobox \} from "@\/components\/members\/MemberCombobox"/);
  assert.equal((source.match(/<MemberCombobox\b/g) ?? []).length, expectedCount);
  for (const marker of markers) assert.match(source, new RegExp(`ariaLabel="${marker}"`));
}

const detail = read("src/components/schedules/ScheduleDetailManager.tsx");
assert.match(detail, /members=\{selectableMembers\}/);
assert.doesNotMatch(detail, /MemberCombobox[\s\S]{0,200}\/api\/schedules/);

const repertoire = read("src/components/schedules/ScheduleRepertoireManager.tsx");
assert.match(repertoire, /members=\{data\?\.members \?\? \[\]\}/);

const users = read("src/components/users/UserManager.tsx");
const accessRequests = read("src/components/access-requests/AccessRequestManager.tsx");
assert.match(users, /searchText: member\.email/);
assert.match(accessRequests, /searchText: member\.email/);

const component = read("src/components/members/MemberCombobox.tsx");
assert.match(component, /if \(!open\) return;[\s\S]*document\.addEventListener\("mousedown", closeOnOutsidePointer\)/);
assert.match(component, /const activeOption = !loading && activeIndex >= 0/);
assert.match(
  component,
  /if \(event\.key === "Enter" && open\) \{\s*event\.preventDefault\(\);/,
  "Enter must not submit the parent form while the combobox search is open",
);
assert.match(
  component,
  /if \(!loading && activeIndex >= 0 && visibleMembers\[activeIndex\]\)/,
  "Enter must not select an option hidden by the loading state",
);

console.log("Member combobox consumers: 25 scenarios passed.");
