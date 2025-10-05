import { FormEvent } from 'react';
import { Badge } from '../atoms/Badge';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';
import { DialogContainer } from '../atoms/DialogContainer';
import { DialogSurface } from '../atoms/DialogSurface';
import { DialogHeader } from '../molecules/DialogHeader';
import { DialogFooter } from '../molecules/DialogFooter';
import { Button } from '../atoms/Button';
import { PlannedExpensesTable } from '../compounds/PlannedExpensesTable';
import { CategoryCreationPanel } from '../compounds/CategoryCreationPanel';

interface PlannedExpensesDialogProps {
  dialog: SmartBudgetingController['dialog'];
}

export function PlannedExpensesDialog({ dialog }: PlannedExpensesDialogProps) {
  const { isOpen, close, handleSubmit, handleAddEntryRow, shouldShowValidationError, isSubmitting } = dialog;

  if (!isOpen) {
    return null;
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(event);
  };

  return (
    <DialogContainer>
      <DialogSurface>
        <form onSubmit={onSubmit} className="space-y-6">
          <DialogHeader
            title="Add planned expenses"
            description="Capture multiple planned expenses at once and assign them to categories."
            onClose={close}
          />

          <PlannedExpensesTable dialog={dialog} />

          <CategoryCreationPanel dialog={dialog} />

          {shouldShowValidationError ? (
            <p className="text-sm text-danger">
              Please complete all required fields before saving your planned expenses. Ensure at least one expense category exists.
            </p>
          ) : null}

          <DialogFooter
            startSlot={
              <Button type="button" variant="secondary" className="text-xs" onClick={handleAddEntryRow}>
                Add another row
              </Button>
            }
            endSlot={
              <>
                <Badge tone="info">Bulk planning</Badge>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save planned expenses'}
                </Button>
              </>
            }
          />
        </form>
      </DialogSurface>
    </DialogContainer>
  );
}
