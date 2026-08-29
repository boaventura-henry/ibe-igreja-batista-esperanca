# Multiple roles per schedule participant

## Transitional model

`ScheduleMemberRoleAssignment` stores the current role collection for a
`ScheduleMember` and is the only functional source of truth. The existing
`ScheduleMember.role` column and index remain temporarily in the schema for a
safe expand/contract rollout.

The legacy column is now only a write-through compatibility projection:

- all official readers load `roles`; an absent or empty collection is treated
  as no assigned function and never rebuilt from `ScheduleMember.role`;

- official writes require a non-empty `roles` collection when functions change;
- the first role in the official order is written to the legacy projection in
  the same transaction, so rollback to the previous runtime remains possible;
- requests containing `role`, alone or together with `roles`, are rejected;
- status-only updates preserve the complete role collection and projection.

The single official presentation/projection order is defined by
`scheduleMemberRoleOptions`: `MINISTER`, `LEADER`, `VOCAL`, `BACKING`,
`INSTRUMENT`, `MEDIA`, `RECEPTION`, `CHILDREN`, `SUPPORT`, `OTHER`. Database
insert order and alphabetical order have no semantic meaning.

Every participant must have at least one role. Duplicate
`(scheduleMemberId, role)` values are rejected by validation and by a database
unique constraint.

## Migration and lifecycle

The foundation migration created one assignment from every existing
`ScheduleMember.role` and aborts if any participant remains without a role.
This compatibility cleanup creates no migration and does not remove the legacy
column or index.
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
already-loaded participant collection by official role priority, member name
and participant id, without an extra query or N+1. It exposes names and
`memberCount`, but no legacy role, User data or asset data. Mobile shows up to three complete
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
mention a role. `ScheduleMember.role` remains a transitional projection.

The singular display helper and every fallback to `ScheduleMember.role` were
removed. The plural helper is the only presentation source. Administrative
detail, member history, Portal, My Schedules, Dashboard and notifications load
the role collection. DTOs and serializers do not expose the legacy field. The
administrative Dashboard does not display participant roles and is therefore
not applicable to this change.

The technical gate reproduced `P2028` in a normal publication with Prisma's
default five-second interactive-transaction timeout. The transaction performs
only database work, while Web Push remains post-commit. Publication now uses
the same local 15-second timeout already established for longer participant
transactions; no global Prisma timeout or generic retry was added. Normal
publication, participant inclusion and two controlled concurrent-publication
scenarios then completed without `P2028`, deadlock or duplicate notifications.

The physical DROP is a separate release stage. Production must first run this
compatibility code with the legacy column and index still present. Only after
that deployment is READY, smoke-tested and free of role-related errors may a
later migration remove the index and column. Until the DROP, rollback to the
previous runtime remains structurally possible because the write-through
projection stays synchronized.
