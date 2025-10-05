import { NavLink } from 'react-router-dom';
import type { NavLinkProps } from 'react-router-dom';
import { cn } from '../../utils/cn';

type Props = NavLinkProps & {
  label: string;
};

export function NavItem({ label, className, ...props }: Props) {
  return (
    <NavLink
      {...props}
      className={({ isActive }) =>
        cn(
          'px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-md',
          isActive ? 'bg-accent text-slate-900' : 'bg-slate-800 hover:bg-slate-700',
          className
        )
      }
    >
      {label}
    </NavLink>
  );
}
