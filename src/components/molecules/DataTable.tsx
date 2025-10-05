import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type DataTableAlignment = 'left' | 'center' | 'right';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  render: (row: T, rowIndex: number) => ReactNode;
  align?: DataTableAlignment;
  width?: string;
  minWidth?: string;
  headerClassName?: string;
  cellClassName?: string | ((row: T, rowIndex: number) => string | false | null | undefined);
}

export interface DataTableProps<T> {
  data: T[];
  columns: Array<DataTableColumn<T>>;
  keyExtractor?: (row: T, rowIndex: number) => string | number;
  emptyState?: ReactNode;
  className?: string;
  rowClassName?: string | ((row: T, rowIndex: number) => string | false | null | undefined);
}

const ALIGNMENT_CLASSNAME_MAP: Record<DataTableAlignment, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
};

function resolveColumnTemplate<T>(column: DataTableColumn<T>) {
  if (column.width && column.minWidth) {
    return `minmax(${column.minWidth}, ${column.width})`;
  }

  if (column.width) {
    return column.width;
  }

  if (column.minWidth) {
    return `minmax(${column.minWidth}, 1fr)`;
  }

  return 'minmax(0, 1fr)';
}

function resolveRowClassName<T>(
  rowClassName: DataTableProps<T>['rowClassName'],
  row: T,
  rowIndex: number
) {
  if (typeof rowClassName === 'function') {
    return rowClassName(row, rowIndex);
  }

  return rowClassName;
}

function resolveCellClassName<T>(
  column: DataTableColumn<T>,
  row: T,
  rowIndex: number
) {
  if (typeof column.cellClassName === 'function') {
    return column.cellClassName(row, rowIndex);
  }

  return column.cellClassName;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  className,
  rowClassName
}: DataTableProps<T>) {
  const columnTemplate = columns.map((column) => resolveColumnTemplate(column)).join(' ');

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div role="table" className="min-w-full divide-y divide-slate-800 text-sm">
        <div role="rowgroup" className="bg-slate-900/80 text-xs uppercase text-slate-400">
          <div
            role="row"
            className="grid gap-x-6 px-4 py-3"
            style={{ gridTemplateColumns: columnTemplate }}
          >
            {columns.map((column) => (
              <div
                key={column.id}
                role="columnheader"
                className={cn('font-semibold', ALIGNMENT_CLASSNAME_MAP[column.align ?? 'left'], column.headerClassName)}
              >
                {column.header}
              </div>
            ))}
          </div>
        </div>

        <div role="rowgroup" className="divide-y divide-slate-800">
          {data.map((row, rowIndex) => {
            const key = keyExtractor ? keyExtractor(row, rowIndex) : rowIndex;
            const computedRowClassName = resolveRowClassName(rowClassName, row, rowIndex);

            return (
              <div
                key={key}
                role="row"
                className={cn(
                  'grid gap-x-6 px-4 py-3 transition-colors hover:bg-slate-800/40',
                  computedRowClassName
                )}
                style={{ gridTemplateColumns: columnTemplate }}
              >
                {columns.map((column) => (
                  <div
                    key={column.id}
                    role="cell"
                    className={cn(
                      ALIGNMENT_CLASSNAME_MAP[column.align ?? 'left'],
                      resolveCellClassName(column, row, rowIndex)
                    )}
                  >
                    {column.render(row, rowIndex)}
                  </div>
                ))}
              </div>
            );
          })}

          {data.length === 0 && emptyState ? (
            <div
              role="row"
              className="grid gap-x-6 px-4 py-6 text-center text-sm text-slate-500"
              style={{ gridTemplateColumns: columnTemplate }}
            >
              <div role="cell" className="col-span-full">
                {emptyState}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
