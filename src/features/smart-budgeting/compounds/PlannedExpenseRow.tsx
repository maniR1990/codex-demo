import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';
import { Checkbox } from '../atoms/Checkbox';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';

interface PlannedExpenseRowProps {
  entry: SmartBudgetingController['dialog']['entries'][number];
  priorityOptions: SmartBudgetingController['dialog']['PRIORITY_OPTIONS'];
  expenseCategories: SmartBudgetingController['dialog']['expenseCategories'];
  canRemove: boolean;
  isCreatingCategory: boolean;
  onEntryChange: SmartBudgetingController['dialog']['handleEntryChange'];
  onRemove: SmartBudgetingController['dialog']['handleRemoveEntryRow'];
  onToggleCategoryCreation: SmartBudgetingController['dialog']['handleToggleCategoryCreation'];
  resolveDefaultDueDate: SmartBudgetingController['dialog']['resolveDefaultDueDate'];
}

export function PlannedExpenseRow({
  entry,
  priorityOptions,
  expenseCategories,
  canRemove,
  isCreatingCategory,
  onEntryChange,
  onRemove,
  onToggleCategoryCreation,
  resolveDefaultDueDate
}: PlannedExpenseRowProps) {
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <Input
          placeholder="e.g. School fees"
          value={entry.name}
          onChange={(event) => onEntryChange(entry.id, { name: event.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={entry.amount}
          onChange={(event) => onEntryChange(entry.id, { amount: event.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-2">
          <Input
            type="date"
            value={entry.dueDate}
            onChange={(event) => onEntryChange(entry.id, { dueDate: event.target.value })}
            disabled={!entry.hasDueDate}
          />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <Checkbox
              checked={!entry.hasDueDate}
              onChange={(event) => {
                const noDueDate = event.target.checked;
                onEntryChange(entry.id, {
                  hasDueDate: !noDueDate,
                  ...(noDueDate ? {} : { dueDate: entry.dueDate || resolveDefaultDueDate() })
                });
              }}
            />
            <span>No due date</span>
          </label>
        </div>
      </td>
      <td className="px-3 py-2">
        <Select
          value={entry.priority}
          onChange={(event) =>
            onEntryChange(entry.id, {
              priority: event.target.value as (typeof priorityOptions)[number]['value']
            })
          }
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-2">
          <Select
            value={entry.categoryId}
            onChange={(event) => onEntryChange(entry.id, { categoryId: event.target.value })}
            disabled={expenseCategories.length === 0}
          >
            <option value="" disabled>
              {expenseCategories.length === 0 ? 'No categories available' : 'Select category'}
            </option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="ghost"
            className="self-start px-0 text-xs font-semibold text-accent"
            onClick={() => onToggleCategoryCreation(entry.id)}
          >
            {isCreatingCategory ? 'Cancel new category' : 'New category'}
          </Button>
        </div>
      </td>
      <td className="px-3 py-2">
        <Button
          type="button"
          variant="secondary"
          className="text-xs"
          onClick={() => onRemove(entry.id)}
          disabled={!canRemove}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}
