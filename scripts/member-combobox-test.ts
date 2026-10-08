import assert from "node:assert/strict";
import {
  filterMemberComboboxOptions,
  memberComboboxLabel,
  nextMemberComboboxIndex,
  sortMemberComboboxOptions
} from "../src/components/members/MemberCombobox";
import { normalizeMemberSearch } from "../src/lib/member-search";

const members = [
  { id: "3", name: "João Henrique Boaventura dos Santos", nickname: "João Henrique" },
  { id: "2", name: "Joana Alves", nickname: null },
  { id: "1", name: "André Gomes", nickname: "Pr André", searchText: "andre@example.test" },
  { id: "4", name: "Ana", nickname: null },
  { id: "5", name: "Ana", nickname: null },
  { id: "6", name: "Paula Gonçalves", nickname: null }
];

function ids(query: string) {
  return filterMemberComboboxOptions(members, query).map((member) => member.id);
}

assert.equal(normalizeMemberSearch(" João "), "joao");
assert.equal(normalizeMemberSearch("André"), "andre");
assert.equal(memberComboboxLabel(members[0]), "João Henrique - João Henrique Boaventura dos Santos");
assert.deepEqual(ids(""), ["4", "5", "2", "3", "6", "1"]);
assert.deepEqual(ids("JOAO"), ["3"]);
assert.deepEqual(ids("joa"), ["2", "3"]);
assert.deepEqual(ids("goncalves"), ["6"]);
assert.deepEqual(ids("boaventura"), ["3"]);
assert.deepEqual(ids("pr andre"), ["1"]);
assert.deepEqual(ids("andre@example"), ["1"]);
assert.deepEqual(sortMemberComboboxOptions(members).filter((member) => member.name === "Ana").map((member) => member.id), ["4", "5"]);
assert.equal(nextMemberComboboxIndex(-1, 2, 1), 0);
assert.equal(nextMemberComboboxIndex(0, 2, -1), 1);
assert.equal(nextMemberComboboxIndex(1, 2, 1), 0);
assert.equal(nextMemberComboboxIndex(0, 0, 1), -1);

console.log("Member combobox: 15 scenarios passed.");
