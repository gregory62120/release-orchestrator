import type { Commit, ParsedGraph, Role, RoleBranches } from './models';
import { ROLES, ROLE_TARGETS } from './models';

export interface TargetCheck {
  role: Role;
  branch: string;
  present: boolean;
  /** Commit équivalent trouvé sur la branche cible. */
  matchId?: string;
  /** true : le commit est directement un ancêtre de la branche cible (pas besoin de cherry-pick). */
  byAncestry: boolean;
}

export interface CommitCheck {
  commit: Commit;
  targets: TargetCheck[];
  missing: Role[];
}

export interface SourceReport {
  kind: 'role' | 'feature';
  /** Nom de la branche analysée. */
  name: string;
  tip: string;
  /** Pour une branche racine, son rôle ; pour une feature, la branche racine dont elle part. */
  root: Role;
  /** Racine détectée automatiquement (feature uniquement). */
  autoRoot?: Role;
  /** Branches vers lesquelles les commits doivent être cherry-pickés. */
  targets: Role[];
  /** Du plus ancien au plus récent. */
  checks: CommitCheck[];
}

export interface VersionEntry {
  tag: string;
  /** Autres tags posés sur le même commit. */
  otherTags: string[];
  commitId: string;
  subject: string;
  /** Commits (hors merges et commits ignorés) livrés depuis la version précédente, du plus ancien au plus récent. */
  commits: Commit[];
  /** Plus ancienne version connue : le contenu n'est pas calculable. */
  initial: boolean;
  latest: boolean;
}

export interface VersionInfo {
  role: Role;
  branch: string;
  tip: string;
  lastTag?: string;
  tagCommit?: string;
  commitsSince: number;
  onTag: boolean;
  recentTags: string[];
  /** Versions de la plus récente à la plus ancienne. */
  history: VersionEntry[];
  /** Commits présents sur la branche depuis la dernière version. */
  pending: Commit[];
}

export interface Analysis {
  /** Rôles effectivement renseignés (dev toujours, patch et TNR facultatifs). */
  roles: Role[];
  versions: VersionInfo[];
  sources: SourceReport[];
  /** Branches sans commit propre (déjà fusionnées dans leur racine). */
  mergedFeatures: string[];
  /** Branches de travail sans tag propre : ni affichées, ni à cherry-picker. */
  untaggedFeatures: string[];
  /** Commits écartés par les mots-clés à ignorer. */
  ignoredCount: number;
  totals: { checked: number; ok: number; missing: number };
  /** Commits manquants par branche cible, du plus ancien au plus récent. */
  todo: Record<Role, Commit[]>;
}

const REMOTE_PREFIX = /^(origin|upstream)\//;
export const localName = (name: string) => name.replace(REMOTE_PREFIX, '');

const normalizeSubject = (s: string) =>
  s
    .replace(/\s*\(cherry[- ]picked from commit [0-9a-f]+\)\s*$/i, '')
    .replace(/\s*\(#\d+\)\s*$/, '')
    // Préfixe ajouté par les branches de cherry-pick : « Cherry-pick/Fix x » équivaut à « Fix x ».
    .replace(/^\s*cherry[- ]?pick[\s/:\-]*/i, '')
    // Espaces ignorés : le retour à la ligne du terminal peut en avoir retiré ou ajouté.
    .replace(/\s+/g, '')
    .toLowerCase();

interface SemVer {
  nums: number[];
  pre: string;
}

function parseSemVer(tag: string): SemVer | undefined {
  const m = /(\d+(?:\.\d+)+)(.*)$/.exec(tag);
  if (!m) return undefined;
  return { nums: m[1].split('.').map(Number), pre: m[2].replace(/^[-.+_]/, '') };
}

function compareSemVer(a: SemVer, b: SemVer): number {
  for (let i = 0; i < Math.max(a.nums.length, b.nums.length); i++) {
    const d = (a.nums[i] ?? 0) - (b.nums[i] ?? 0);
    if (d) return d;
  }
  if (a.pre === b.pre) return 0;
  if (!a.pre) return 1; // une version stable est supérieure à une pré-version
  if (!b.pre) return -1;
  return a.pre.localeCompare(b.pre, undefined, { numeric: true });
}

class GraphIndex {
  private readonly cache = new Map<string, Set<string>>();
  private readonly position = new Map<string, number>();

  ignored = 0;

  constructor(
    readonly graph: ParsedGraph,
    private readonly keywords: string[] = [],
    private readonly ignoredIds: ReadonlySet<string> = new Set(),
  ) {
    graph.commits.forEach((c, i) => this.position.set(c.id, i));
  }

  ancestors(tip: string): Set<string> {
    const cached = this.cache.get(tip);
    if (cached) return cached;
    const seen = new Set<string>();
    const stack = [tip];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const p of this.graph.byId.get(id)?.parents ?? []) stack.push(p);
    }
    this.cache.set(tip, seen);
    return seen;
  }

  private isIgnored(c: Commit) {
    if (this.ignoredIds.has(c.id)) return true;
    const subject = c.subject.toLowerCase();
    const hit = this.keywords.some((k) => subject.includes(k));
    if (hit) this.ignored++;
    return hit;
  }

  isMerge(c: Commit) {
    return c.parents.length > 1;
  }

  /** Du plus ancien au plus récent. */
  oldestFirst(ids: Iterable<string>): Commit[] {
    return [...ids]
      .map((id) => this.graph.byId.get(id)!)
      .filter((c) => c && !this.isMerge(c) && !this.isIgnored(c))
      .sort((a, b) => this.position.get(b.id)! - this.position.get(a.id)!);
  }

  subjectIndex(tip: string): Map<string, Commit> {
    const index = new Map<string, Commit>();
    for (const id of this.ancestors(tip)) {
      const c = this.graph.byId.get(id);
      if (!c || this.isMerge(c)) continue;
      const key = normalizeSubject(c.subject);
      const existing = index.get(key);
      if (!existing || this.position.get(c.id)! < this.position.get(existing.id)!) index.set(key, c);
    }
    return index;
  }
}

export function tipOf(graph: ParsedGraph, branch: string): string | undefined {
  return graph.branches.find((b) => b.name === branch)?.tip;
}

/**
 * Version d'une branche = tag le plus proche en suivant uniquement le premier parent
 * (comme `git describe --first-parent`), pour ne pas récupérer les tags d'autres branches fusionnées.
 */
function computeVersion(ix: GraphIndex, role: Role, branch: string, tip: string): VersionInfo {
  const chain: Commit[] = [];
  const seen = new Set<string>();
  for (let id: string | undefined = tip; id && !seen.has(id); ) {
    seen.add(id);
    const c = ix.graph.byId.get(id);
    if (!c) break;
    chain.push(c);
    id = c.parents[0];
  }

  const tagged = chain.filter((c) => c.tags.length);
  if (!tagged.length) {
    return { role, branch, tip, commitsSince: ix.ancestors(tip).size, onTag: false, recentTags: [], history: [], pending: [] };
  }

  const byVersion = (a: string, b: string) => {
    const va = parseSemVer(a);
    const vb = parseSemVer(b);
    return va && vb ? compareSemVer(vb, va) : va ? -1 : vb ? 1 : 0;
  };
  const nearest = tagged[0];
  const lastTag = nearest.tags.slice().sort(byVersion)[0];

  const anc = ix.ancestors(tip);
  const behind = ix.ancestors(nearest.id);
  let commitsSince = 0;
  for (const id of anc) if (!behind.has(id)) commitsSince++;

  const history: VersionEntry[] = tagged.map((c, i) => {
    const previous = tagged[i + 1];
    const [main, ...otherTags] = c.tags.slice().sort(byVersion);
    return {
      tag: main,
      otherTags,
      commitId: c.id,
      subject: c.subject,
      commits: previous
        ? ix.oldestFirst(difference(ix.ancestors(c.id), ix.ancestors(previous.id)))
        : [],
      initial: !previous,
      latest: i === 0,
    };
  });
  const pending = ix.oldestFirst(difference(anc, behind));

  return {
    role,
    branch,
    tip,
    history,
    pending,
    lastTag,
    tagCommit: nearest.id,
    commitsSince,
    onTag: nearest.id === tip,
    recentTags: tagged
      .flatMap((c) => c.tags)
      .filter((t) => t !== lastTag)
      .slice(0, 5),
  };
}

/** Devine la branche racine d'une feature d'après la proximité de son point de départ. */
function detectRoot(ix: GraphIndex, name: string, tip: string, roots: Record<Role, Set<string>>, active: Role[]): Role {
  const dist: Record<Role, number> = { tnr: Infinity, patch: Infinity, dev: Infinity };
  const seen = new Set<string>([tip]);
  let frontier = [tip];
  for (let d = 0; frontier.length && active.some((r) => dist[r] === Infinity); d++) {
    const nextFrontier: string[] = [];
    for (const id of frontier) {
      for (const r of active) if (dist[r] === Infinity && roots[r].has(id)) dist[r] = d;
      for (const p of ix.graph.byId.get(id)?.parents ?? []) {
        if (!seen.has(p)) {
          seen.add(p);
          nextFrontier.push(p);
        }
      }
    }
    frontier = nextFrontier;
  }

  const min = Math.min(...active.map((r) => dist[r]));
  const tied = active.filter((r) => dist[r] === min);
  if (tied.length === 1) return tied[0];

  const candidates = tied.length ? tied : active;
  const hint: Role | undefined = /tnr/i.test(name) ? 'tnr' : /hotfix|patch/i.test(name) ? 'patch' : undefined;
  if (hint && candidates.includes(hint)) return hint;
  return candidates.includes('dev') ? 'dev' : candidates[0];
}

export function analyze(
  graph: ParsedGraph,
  selection: RoleBranches,
  rootOverrides: Record<string, Role> = {},
  ignoreKeywords: string[] = [],
  ignoredIds: ReadonlySet<string> = new Set(),
): Analysis | undefined {
  // La branche de dev est obligatoire ; patch et TNR sont facultatives.
  const active = ROLES.filter((r) => selection[r]);
  if (!active.includes('dev')) return undefined;
  const tips = {} as Record<Role, string>;
  for (const r of active) {
    const tip = tipOf(graph, selection[r]);
    if (!tip) return undefined;
    tips[r] = tip;
  }
  const targetsOf = (role: Role) => ROLE_TARGETS[role].filter((r) => active.includes(r));

  const keywords = ignoreKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const ix = new GraphIndex(graph, keywords, ignoredIds);
  const anc = {} as Record<Role, Set<string>>;
  const subjects = {} as Record<Role, Map<string, Commit>>;
  for (const r of ROLES) {
    anc[r] = active.includes(r) ? ix.ancestors(tips[r]) : new Set();
    subjects[r] = active.includes(r) ? ix.subjectIndex(tips[r]) : new Map();
  }

  const check = (commit: Commit, targets: Role[]): CommitCheck => {
    const results: TargetCheck[] = targets.map((role) => {
      const branch = selection[role];
      if (anc[role].has(commit.id)) return { role, branch, present: true, matchId: commit.id, byAncestry: true };
      const match = subjects[role].get(normalizeSubject(commit.subject));
      return { role, branch, present: !!match, matchId: match?.id, byAncestry: false };
    });
    return { commit, targets: results, missing: results.filter((t) => !t.present).map((t) => t.role) };
  };

  const sources: SourceReport[] = [];

  // Branches racines : TNR → (patch, dev), patch → dev.
  const ownRole: Record<Role, Set<string>> = {
    tnr: difference(anc.tnr, anc.patch, anc.dev),
    patch: difference(anc.patch, anc.dev),
    dev: new Set(),
  };
  for (const role of (['tnr', 'patch'] as Role[]).filter((r) => active.includes(r))) {
    sources.push({
      kind: 'role',
      name: selection[role],
      tip: tips[role],
      root: role,
      targets: targetsOf(role),
      checks: ix.oldestFirst(ownRole[role]).map((c) => check(c, targetsOf(role))),
    });
  }

  // Autres branches : cherry-pick vers leur racine puis en cascade.
  const rolesNames = new Set(active.map((r) => localName(selection[r])));
  const rolesTips = new Set(Object.values(tips));
  const featureBranches = graph.branches.filter((b) => {
    if (rolesNames.has(localName(b.name))) return false;
    if (rolesTips.has(b.tip)) return false;
    // Un `origin/x` identique à la branche locale `x` est ignoré.
    if (b.remote && graph.branches.some((o) => !o.remote && o.name === localName(b.name) && o.tip === b.tip)) return false;
    return true;
  });

  const mergedFeatures: string[] = [];
  const untaggedFeatures: string[] = [];
  for (const b of featureBranches) {
    const autoRoot = detectRoot(ix, b.name, b.tip, anc, active);
    const root = rootOverrides[b.name] ?? autoRoot;
    const own = difference(ix.ancestors(b.tip), anc[root]);
    // Rien n'est jamais cherry-pické sur TNR : une branche issue de TNR ou de patch va sur patch et dev.
    const targets: Role[] = root === 'tnr' ? targetsOf('tnr') : [root, ...targetsOf(root)];
    const checks = ix.oldestFirst(own).map((c) => check(c, targets));
    if (!checks.length) {
      mergedFeatures.push(b.name);
      continue;
    }
    // Une branche n'est affichée que si l'un de ses commits propres (absents des autres branches) porte un tag.
    // Sinon c'est une simple branche de travail : rien à cherry-picker, elle n'est pas listée.
    const others = graph.branches
      .filter((o) => o.tip !== b.tip && localName(o.name) !== localName(b.name))
      .map((o) => ix.ancestors(o.tip));
    const specific = [...own].filter((id) => !others.some((a) => a.has(id)));
    if (!specific.some((id) => graph.byId.get(id)?.tags.length)) {
      untaggedFeatures.push(b.name);
      continue;
    }
    sources.push({ kind: 'feature', name: b.name, tip: b.tip, root, autoRoot, targets, checks });
  }

  const todoSets: Record<Role, Map<string, Commit>> = { tnr: new Map(), patch: new Map(), dev: new Map() };
  let checked = 0;
  let ok = 0;
  // Chaque couple (commit, branche cible) n'est compté qu'une fois, même s'il apparaît dans plusieurs branches.
  const counted = new Set<string>();
  for (const c of sources.flatMap((s) => s.checks)) {
    for (const t of c.targets) {
      const key = `${c.commit.id}>${t.role}`;
      if (counted.has(key)) continue;
      counted.add(key);
      checked++;
      if (t.present) ok++;
      else todoSets[t.role].set(c.commit.id, c.commit);
    }
  }
  const order = new Map(graph.commits.map((c, i) => [c.id, i]));
  const todo = {} as Record<Role, Commit[]>;
  for (const r of ROLES) {
    todo[r] = [...todoSets[r].values()].sort((a, b) => order.get(b.id)! - order.get(a.id)!);
  }

  return {
    roles: active,
    versions: active
      .slice()
      .reverse()
      .map((r) => computeVersion(ix, r, selection[r], tips[r])),
    sources,
    mergedFeatures,
    untaggedFeatures,
    ignoredCount: ix.ignored,
    totals: { checked, ok, missing: checked - ok },
    todo,
  };
}

function difference(base: Set<string>, ...others: Set<string>[]): Set<string> {
  const out = new Set<string>();
  for (const id of base) if (!others.some((o) => o.has(id))) out.add(id);
  return out;
}

/** Propose une branche pour chaque rôle d'après son nom. */
export function suggestBranches(graph: ParsedGraph): Partial<RoleBranches> {
  const names = graph.branches.map((b) => b.name);
  const find = (re: RegExp) => names.find((n) => !REMOTE_PREFIX.test(n) && re.test(n)) ?? names.find((n) => re.test(n));
  return {
    dev: find(/^(develop|dev|main|master)$/i) ?? find(/dev/i),
    patch: find(/patch|hotfix|maintenance|release/i),
    tnr: find(/tnr|recette|qa|test/i),
  };
}
