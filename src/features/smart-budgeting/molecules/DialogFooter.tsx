import type { ReactNode } from 'react';

interface DialogFooterProps {
  startSlot?: ReactNode;
  endSlot?: ReactNode;
}

export function DialogFooter({ startSlot, endSlot }: DialogFooterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">{startSlot}</div>
      <div className="flex items-center gap-3 text-xs text-slate-400">{endSlot}</div>
    </div>
  );
}
