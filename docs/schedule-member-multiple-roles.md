# Multiple roles per schedule participant

## Current model

`ScheduleMemberRoleAssignment` stores the current role collection for a
`ScheduleMember` and is the only source of truth. The legacy
`ScheduleMember.role` column and its index were physically removed in the
0.2.5 final cleanup Story.

The role collection is the source of truth for all domain decisions:

- all official readers load `roles`; an absent or empty collection is treated
  as no assigned function and never rebuilt from `ScheduleMember.role`;

- official create requests require a non-empty `roles` collection;
- update requests use `roles` only when changing functions, while status-only
  self-service updates preserve the complete collection;
- requests containing the legacy `role` field, alone or together with `roles`,
  are rejected explicitly to prevent two sources of truth.

The single official presentation/projection order is defined by
`scheduleMemberRoleOptions`: `MINISTER`, `LEADER`, `VOCAL`, `BACKING`,
`INSTRUMENT`, `MEDIA`, `RECEPTION`, `CHILDREN`, `SUPPORT`, `OTHER`. Database
insert order and alphabetical order have no semantic meaning.

Every participant must have at least one role. Duplicate
`(scheduleMemberId, role)` values are rejected by validation and by a database
unique constraint.

## Migrations and lifecycle

The foundation migration created one assignment from every existing
`ScheduleMember.role` and aborts if any participant remains without a role.
The final migration drops only `ScheduleMember_role_idx` and
`ScheduleMember.role` after aggregate validation confirms complete assignment
coverage and no duplicates.
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

The administrative schedule detail now presents every assigned role through
`getScheduleMemberDisplayRoles`. Presentation is deterministic and follows the
central role priority with two explicit product conventions: `LEADER` is shown
before `MINISTER`, and an `INSTRUMENT` category is shown before `BACKING` while
remaining after `MINISTER`. Thus the supported examples are `Lider • Ministro`,
`Baixo • Backing` and `Ministro • Violao`. When no category exists, the helper
uses `Instrumento`; physical asset names are never included.

The administrative list selects participant names and role assignments in the
same relational query as the paginated schedules. The Service sorts each
already-loaded participant collection by the smallest official role priority,
then member name and participant id. This adds no query and no N+1. The response
exposes names and `memberCount`, but no legacy role, assignments, User data or
asset data. Mobile shows up to three complete
names and desktop up to five before a pluralized `+N membros` summary. One
`ScheduleMember` always counts once, regardless of its role count. `REPLACED`
participants remain included because this Story preserves the previous rule of
counting every non-deleted `ScheduleMember`.

Portal and My Schedules now present every role through
`getScheduleMemberDisplayRoles`, including the friendly instrumental category
without exposing the physical asset. They still render one participation, one
status and one set of confirmation/refusal actions per `ScheduleMember`.
Instrument self-service eligibility uses the role collection. The Portal
Dashboard uses the same projection for the next schedule, and both surfaces
allow natural text wrapping on mobile.

Initial schedule publication and later participant inclusion now use
`getScheduleMemberDisplayRoles`, so the persisted Notification and its
post-commit Web Push share the same multiple-role presentation as the screens.
The relational schedule query already loads role assignments and the friendly
instrument category in one pass; physical asset data is not used in the
message. Reminders remain unchanged because their current wording does not
mention a role.

The singular presentation helper and its fallback were removed. The plural
helper is the only presentation source. Administrative detail, member history,
Portal, My Schedules, Dashboard and schedule notifications load the role
collection. Internal DTOs and serializers no longer expose the legacy role.
The administrative Dashboard does not display participant roles and is
therefore not applicable to this change.

## Physical-drop guarantees

All official writers create or update `ScheduleMemberRoleAssignment` in the
same transaction as the parent and reject an empty collection. Permanent test
fixtures follow the same invariant. `prisma/seed.ts` does not create schedule
participants, so no seed migration is applicable.

PostgreSQL still cannot express an "at least one child row" invariant with a
simple foreign key or check constraint. A deferred constraint trigger could
enforce it, but would add operational complexity without protecting supported
application paths further. The accepted approach after the DROP is the
transactional application guarantee. Direct SQL can still create a parent with
no role assignment; this is a documented residual risk and direct writes are
not a supported integration contract.

The schema, Prisma Client, repositories, Services, DTOs and permanent fixtures
no longer read or write the singular field. The `ScheduleMemberRole` enum is
preserved because it remains the type of `ScheduleMemberRoleAssignment.role`.

## Production rollout

`vercel-build` runs `prisma migrate deploy` before `next build`. A physical
DROP is incompatible with an older Production runtime that still selects
`ScheduleMember.role`: during a normal deployment, the previous runtime can
continue receiving traffic after the migration has already removed the column.
The safe rollout is explicitly two-phase: first deploy and activate the
compatibility release that has zero reads or writes of the legacy column while
the column still exists; only then deploy this DROP release. Rollback after the
DROP must use a database restore or a forward migration and must not reactivate
an old runtime that depends on the removed column.

The technical gate reproduced `P2028` in a normal publication with Prisma's
default five-second interactive-transaction timeout. The transaction performs
only database work, while Web Push remains post-commit. Publication now uses
the same local 15-second timeout already established for longer participant
transactions; no global Prisma timeout or generic retry was added. Normal
publication, participant inclusion and two controlled concurrent-publication
scenarios then completed without `P2028`, deadlock or duplicate notifications.

No external consumer is known in this repository. The API rejects singular
request payloads and does not preserve `role` in the migrated responses; any
unversioned external consumer relying on that field must migrate to `roles`.
