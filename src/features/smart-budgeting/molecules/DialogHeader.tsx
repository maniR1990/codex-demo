import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from '../atoms/Button';

interface DialogHeaderProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}

export function DialogHeader({ title, description, onClose, actions }: PropsWithChildren<DialogHeaderProps>) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-slate-100">{title}</h3>
        {description ? <div className="text-sm text-slate-400">{description}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button type="button" variant="secondary" className="text-xs uppercase tracking-wide" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
