import type { Role } from './models';

export const ROLE_CHIP: Record<Role, string> = {
  tnr: 'bg-violet-100 text-violet-800 ring-violet-200',
  patch: 'bg-amber-100 text-amber-800 ring-amber-200',
  dev: 'bg-sky-100 text-sky-800 ring-sky-200',
};

export const ROLE_BAR: Record<Role, string> = {
  tnr: 'border-violet-500',
  patch: 'border-amber-500',
  dev: 'border-sky-500',
};
