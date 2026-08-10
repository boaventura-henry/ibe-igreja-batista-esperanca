import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMemberDisplayName } from "../src/utils/member-display-name";

const scenarios = [
  { name: "Joao Henrique dos Santos", nickname: "Joao", primary: "Joao", secondary: "Joao Henrique dos Santos" },
  { name: "Maria Aparecida", nickname: null, primary: "Maria Aparecida", secondary: null },
  { name: "Pedro Henrique", nickname: "", primary: "Pedro Henrique", secondary: null },
  { name: "Ana Carolina", nickname: "   ", primary: "Ana Carolina", secondary: null },
  { name: "Carlos", nickname: "Carlos", primary: "Carlos", secondary: null }
];

for (const scenario of scenarios) {
  const primary = getMemberDisplayName(scenario);
  const secondary = primary !== scenario.name ? scenario.name : null;
  assert.equal(primary, scenario.primary);
  assert.equal(secondary, scenario.secondary);
}

const repositorySource = readFileSync("src/repositories/birthday.repository.ts", "utf8");
const cardSource = readFileSync("src/components/dashboard/BirthdayCard.tsx", "utf8");
const memberSource = readFileSync("src/components/members/MemberManager.tsx", "utf8");
const portalProfileSource = readFileSync("src/components/portal/MemberProfileForm.tsx", "utf8");

assert.match(repositorySource, /SELECT id, name, nickname,/);
assert.match(cardSource, /person\.displayName !== person\.name/);
assert.match(memberSource, /Como sou conhecido na igreja/);
assert.match(portalProfileSource, /Como sou conhecido na igreja/);
assert.doesNotMatch(memberSource, /label="Apelido"/);
assert.doesNotMatch(portalProfileSource, /label="Apelido"/);

console.log(`Birthday display name: ${scenarios.length} scenarios passed.`);
