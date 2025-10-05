# Task: Sync planned item mutations with ledger snapshot data

## Summary
The ledger snapshot in the Smart Budgeting view reads from `budgetMonth.plannedItems`, but the store only mutates the legacy `plannedExpenses` array when users add, update, or delete planned entries. This leaves stale rows in the snapshot and causes budget totals to misreport until `plannedItems` is refreshed.

## Acceptance Criteria
- [ ] When adding a planned or recorded item, both `plannedExpenses` and `plannedItems` remain in sync.
- [ ] Updating an existing planned entry also updates the corresponding entry within `plannedItems`.
- [ ] Deleting a planned or recorded item removes it from `plannedItems` so the ledger snapshot immediately reflects the change.
- [ ] `recomputeBudgetMonth` receives the refreshed `plannedItems` array so downstream totals use the latest data.
- [ ] Manual verification from the Smart Budgeting view confirms the ledger snapshot and month totals adjust correctly after add/update/delete operations.

## Implementation Notes
- Consider deriving the updated `plannedItems` list directly from `plannedExpenses` inside `addPlannedExpense`, `updatePlannedExpense`, and `deletePlannedExpense` within `src/store/FinancialStoreProvider.tsx` before invoking `recomputeBudgetMonth`.
- Ensure no duplicate normalisation logic is introduced—reuse existing helpers where possible.
