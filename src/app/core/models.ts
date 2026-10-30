export interface Commit {
  id: string;
  subject: string;
  parents: string[];
  tags: string[];
}

export interface BranchRef {
  name: string;
  tip: string;
  remote: boolean;
}

export interface ParsedGraph {
  /** Ordre du git log : du plus récent au plus ancien. */
  commits: Commit[];
  byId: Map<string, Commit>;
  branches: BranchRef[];
  head?: string;
  warnings: string[];
}

export type Role = 'tnr' | 'patch' | 'dev';

export const ROLES: Role[] = ['tnr', 'patch', 'dev'];

export const ROLE_LABEL: Record<Role, string> = {
  tnr: 'TNR',
  patch: 'Patch',
  dev: 'Dev',
};

/** Branches vers lesquelles un commit d'une branche racine doit être cherry-pické. */
export const ROLE_TARGETS: Record<Role, Role[]> = {
  tnr: ['patch', 'dev'],
  patch: ['dev'],
  dev: [],
};

export type RoleBranches = Record<Role, string>;
