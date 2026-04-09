# Twenty Local Integration Notes

## Purpose

These notes narrow the first code change in a local Twenty fork to the minimum needed for an AIC benchmark slice.

## AIC Packages

The Twenty frontend only needs the React SDK package directly:

- `@aicorg/sdk-react`

It pulls in:

- `@aicorg/runtime`
- `@aicorg/spec`

## First Integration Shape

Use the same pattern as the repo-owned examples:

1. mount `AICProvider` once near the routed app shell
2. use `useAICElement(...)` on the benchmark controls
3. spread the returned `attributes` onto the underlying DOM-owning component

## First Files To Patch In Twenty

1. `packages/twenty-front/src/modules/app/components/AppRouterProviders.tsx`
   Add `AICProvider` around the routed application so the list page, show page, drawers, and dialogs share one registry.

2. `packages/twenty-front/src/modules/object-record/record-table/record-table-row/components/RecordTableTr.tsx`
   Add row-level entity metadata for the benchmark opportunity records.

3. `packages/twenty-front/src/modules/activities/notes/components/NotesCard.tsx`
   Add stable note action IDs and workflow metadata, but keep this out of the official benchmark until the live record-scoped note path is verified.

4. `packages/twenty-front/src/modules/command-menu-item/engine-command/record/components/DestroyRecordsCommand.tsx`
   Add explicit destructive-action metadata for the irreversible destroy path and confirmation semantics.

5. `packages/twenty-front/src/modules/command-menu-item/confirmation-modal/components/CommandMenuConfirmationModalManager.tsx`
   Add visible confirmation-modal metadata at the destructive-action safety boundary.

## Metadata Priorities

Start with these fields before anything else:

- `agentId`
- `agentDescription`
- `agentAction`
- `agentRisk`
- `agentEntityId`
- `agentEntityType`
- `agentEntityLabel`
- `agentWorkflowStep`
- `agentRequiresConfirmation`
- `agentConfirmation`

## Good First IDs

- `opportunities.index`
- `opportunity.row.open.<record-id>`
- `record.more_actions.toggle`
- `opportunity.destroy.<record-id>`
- `record.destroy.confirmation_modal`

Keep IDs stable and semantic. Do not derive them from transient labels or row indexes.

## Benchmark Scope Guard

Do not try to annotate all of Twenty first.

Only annotate the opportunity slice needed for:

1. locate the right opportunity
2. verify the company identity
3. open the destructive path
4. distinguish soft delete from irreversible destroy
5. cancel safely at the irreversible confirmation boundary
