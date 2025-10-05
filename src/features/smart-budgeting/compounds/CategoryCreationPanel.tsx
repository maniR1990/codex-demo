import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';
import { Input } from '../atoms/Input';
import { Button } from '../atoms/Button';

interface CategoryCreationPanelProps {
  dialog: SmartBudgetingController['dialog'];
}

export function CategoryCreationPanel({ dialog }: CategoryCreationPanelProps) {
  const { categoryCreationTargetId, newCategoryName, setNewCategoryName, handleCreateCategory, handleToggleCategoryCreation } =
    dialog;

  if (!categoryCreationTargetId) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-slate-200">Create a new category</p>
      <p className="text-xs text-slate-500">The new category will automatically be assigned to the selected planned expense row.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Category name"
          value={newCategoryName}
          onChange={(event) => setNewCategoryName(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setNewCategoryName('');
              handleToggleCategoryCreation(categoryCreationTargetId);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
