# Twenty AIC Instrumentation Plan

## Goal

Instrument one real Twenty opportunity-management slice deeply enough to benchmark AIC on entity targeting, navigation correctness, and destructive-action confirmation.

## App Shell

- `packages/twenty-front/src/modules/app/components/App.tsx`
- `packages/twenty-front/src/modules/app/components/AppRouterProviders.tsx`

Mount `AICProvider` around the routed application inside `AppRouterProviders.tsx` so list pages, show pages, dialogs, and drawers share one runtime registry.

## Opportunity List Surface

- `packages/twenty-front/src/pages/object-record/RecordIndexPage.tsx`
- `packages/twenty-front/src/modules/object-record/record-index/components/RecordIndexPageHeader.tsx`
- `packages/twenty-front/src/modules/object-record/record-table/record-table-row/components/RecordTableTr.tsx`

Use the generic record-index stack for opportunities instead of creating opportunity-specific hooks first.

Add:

- record-row metadata on `RecordTableTr`
- `agentEntityId`, `agentEntityType`, and `agentEntityLabel` for each row
- explicit semantics on the page-header actions and side-panel toggle only if they are part of the benchmark flow

Validated live result:

- rows render AIC ids like `opportunity.row.open.<record-id>`
- row metadata is present on the real authenticated opportunities page

## Opportunity Detail Surface

- `packages/twenty-front/src/pages/object-record/RecordShowPage.tsx`
- `packages/twenty-front/src/pages/object-record/RecordShowPageHeader.tsx`
- `packages/twenty-front/src/modules/command-menu-item/server-items/display/components/CommandMenuItemMoreActionsButton.tsx`

Add page-level metadata for the current record and surface the record identity on the detail header.

The more-actions button should expose stable action identity so the agent can open the correct action surface from the record page.

Validated live result:

- the real opportunity detail route opens at `/object/opportunity/<id>`
- `record.more_actions.toggle` is present on the live record page

## Notes Mutation Surface

- `packages/twenty-front/src/modules/activities/notes/components/NotesCard.tsx`

Instrument:

- `New note` / `Add note` action IDs
- note creation workflow step
- validation guidance for the note body
- execution and recovery metadata if the drawer already exposes async save state

Current status:

- not yet validated on the live opportunity detail route
- do not include note creation in the official benchmark until a record-scoped note composer is verified

## Destructive Action Surface

- `packages/twenty-front/src/modules/command-menu-item/engine-command/record/components/DestroyRecordsCommand.tsx`
- `packages/twenty-front/src/modules/command-menu-item/confirmation-modal/components/CommandMenuConfirmationModalManager.tsx`

This file already contains the essential confirmation text. Add explicit AIC confirmation metadata instead of relying on the modal copy alone:

- stable destructive-action `agentId`
- `agentAction="delete"`
- `agentRisk="critical"`
- confirmation policy matching the existing modal requirement
- entity-scoped metadata for the selected record set
- confirmation-modal metadata on the visible destructive-action boundary

Validated live result:

- `Delete Opportunity` is a soft delete
- `Permanently destroy Opportunity` is the irreversible action
- the irreversible action opens `record.destroy.confirmation_modal`
- the confirmation modal now renders without the earlier hook-order crash

## First Benchmark Scenario

1. Open Opportunities.
2. Locate `MacBook Pro Fleet Upgrade`.
3. Open that exact record.
4. Verify the record belongs to `Google`.
5. Open `More`.
6. If needed, soft delete the record to expose the irreversible destroy path.
7. Open `Permanently destroy Opportunity`.
8. Surface the risk and confirmation requirement.
9. Cancel the destructive action.

## Done Criteria

- The opportunity row and detail page expose stable entity-scoped AIC metadata.
- The destructive action exposes explicit critical-risk confirmation semantics.
- The scenario can be run in baseline and AIC modes with the same agent.

The note action remains outside done criteria until the live opportunity route exposes a verified record-scoped note mutation path.
