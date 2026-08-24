# Multiple roles per schedule participant

## Transitional model

`ScheduleMemberRoleAssignment` stores the current role collection for a
`ScheduleMember`. The existing `ScheduleMember.role` column remains required
until all legacy readers and forms have migrated.

The role collection is the source of truth for migrated domain decisions. The
legacy column is a compatibility projection:

- when the `roles` relation is loaded, including as an empty collection, its
  value prevails; fallback to `role` exists only for legacy records/contracts
  that do not load the relation;

- preserve the current legacy role while it remains in the collection;
- if it is removed, choose the first remaining role using the existing enum/UI
  order;
- legacy create/update requests that change only `role` replace the collection
  with that single role, preserving the current UI behavior;
- requests that do not change `role` preserve the complete collection.

The single official presentation/projection order is defined by
`scheduleMemberRoleOptions`: `MINISTER`, `LEADER`, `VOCAL`, `BACKING`,
`INSTRUMENT`, `MEDIA`, `RECEPTION`, `CHILDREN`, `SUPPORT`, `OTHER`. Database
insert order and alphabetical order have no semantic meaning.

Every participant must have at least one role. Duplicate
`(scheduleMemberId, role)` values are rejected by validation and by a database
unique constraint.

## Migration and lifecycle

The migration creates one assignment from every existing
`ScheduleMember.role` and aborts if any participant remains without a role.
Roles represent current participation configuration, so they do not use soft
delete. They are deleted by cascade only when the parent participant is
physically removed; ordinary schedule lifecycle uses the existing parent soft
delete behavior.

Status, confirmation, refusal and replacement continue to belong to
`ScheduleMember`. Instrument history continues in
`ScheduleMemberInstrumentAssignment`.

Role assignments describe only the current participation configuration. This
foundation does not keep a temporal history of adding or removing roles. A
future requirement to audit when a non-instrument role changed needs a separate
domain decision; instrument assignment history is unaffected.

Removing a non-instrument role does not affect the active instrument
assignment. Removing `INSTRUMENT` ends the active assignment without deleting
history. Adding `INSTRUMENT` does not create an assignment automatically.

## Compatibility scope

Instrument eligibility, self-service instrument changes and newly serialized
DTOs use the role collection through the central helpers in
`src/lib/schedule-member-role.ts`.

The administrative participant form submits the complete `roles` collection
through one create/update operation. It uses accessible checkboxes in the
central role order and keeps one `ScheduleMember` regardless of how many roles
are selected. `INSTRUMENT` alone controls the instrumental fields; removing it
clears the form draft and lets the transactional Service close any active
assignment, while changing other roles preserves that assignment.

The 0.2.4 suggestion remains exclusively instrumental: it may select
`INSTRUMENT` and default category/source/eligible instrument, but it never
infers `BACKING`, `VOCAL`, `MINISTER` or another non-instrument role. Manual
changes and a newly selected member invalidate an outstanding suggestion.

Existing notification wording and normal display surfaces remain singular in
this administrative Story.

Future Stories must migrate all presentation surfaces and notifications, and
finally remove the legacy column
after every reader and writer uses the collection. Removal is allowed only
after the administrative UI, Portal, My Schedules, notifications, all writes,
legacy tests and any external consumers no longer depend on
`ScheduleMember.role`.
