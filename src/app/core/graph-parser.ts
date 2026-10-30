import type { BranchRef, Commit, ParsedGraph } from './models';

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const GRAPH_ONLY = /^[ |\\/_*.\-]+$/;
const COMMIT_LINE = /^([ |\\/_*.\-]*)([0-9a-f]{7,40})(?: \(([^)]*)\))? ?(.*)$/;
const REMOTE_PREFIX = /^(origin|upstream)\//;

/**
 * Une "lane" dessinée par git : sa position (en caractères), les commits enfants
 * qui attendent encore leur parent, et si elle vient de se décaler en diagonale
 * (une lane décalée peut passer "par-dessus" une autre lane, ce qui donne `|/|`).
 */
interface Lane {
  pos: number;
  ids: string[];
  moved: boolean;
}

const uniq = (ids: string[]) => [...new Set(ids)];

/** Un `_` accolé à la position d'arrivée prolonge le décalage vers la gauche (`|_|/`). */
function slide(line: string, pos: number): number {
  while (line[pos - 1] === '_') pos -= 2;
  return pos;
}

/** Applique une ligne de liaison (`|`, `/`, `\`) aux lanes courantes. */
function advance(lanes: Lane[], line: string, lastCommit?: string, commitRow = false): Lane[] {
  const next: Lane[] = [];
  const positions = [...new Set(lanes.map((l) => l.pos))];
  for (const q of positions) {
    const here = lanes.filter((l) => l.pos === q).sort((a, b) => Number(b.moved) - Number(a.moved));
    const exits = {
      left: line[q - 1] === '/',
      right: line[q + 1] === '\\',
      // Sur une ligne de commit, une lane qui s'apprête à se décaler reste dessinée en `/` ou `\\`.
      stay: line[q] === '|' || (commitRow && (line[q] === '/' || line[q] === '\\')),
    };
    const allIds = uniq(here.flatMap((l) => l.ids));
    const stayers: Lane[] = [];

    for (const lane of here) {
      if (lane.moved && exits.left) {
        exits.left = false;
        next.push({ pos: slide(line, q - 2), ids: lane.ids, moved: true });
      } else if (lane.moved && exits.right) {
        exits.right = false;
        next.push({ pos: q + 2, ids: lane.ids, moved: true });
      } else {
        stayers.push(lane);
      }
    }

    if (stayers.length) {
      const ids = uniq(stayers.flatMap((l) => l.ids));
      if (exits.stay) {
        exits.stay = false;
        next.push({ pos: q, ids, moved: false });
      } else if (exits.left) {
        exits.left = false;
        next.push({ pos: slide(line, q - 2), ids, moved: true });
      } else if (exits.right) {
        exits.right = false;
        next.push({ pos: q + 2, ids, moved: true });
      }
    }

    // Sortie restante sans lane dédiée : un commit de merge qui se divise.
    // Le suffixe `^` marque un parent secondaire (lane issue d'un merge) pour conserver l'ordre des parents.
    const fan = (stayers.length ? uniq(stayers.flatMap((l) => l.ids)) : allIds).map((i) => i + '^');
    if (exits.right) next.push({ pos: q + 2, ids: fan, moved: true });
    if (exits.left && stayers.length) next.push({ pos: slide(line, q - 2), ids: fan, moved: true });
    if (exits.stay && stayers.length === 0 && here.length) next.push({ pos: q, ids: allIds, moved: false });
  }

  // `\` sans lane source (octopus merge) : on repart du dernier commit.
  for (let p = 0; p < line.length; p++) {
    if (line[p] === '\\' && !lanes.some((l) => l.pos === p - 1) && lastCommit) {
      next.push({ pos: p + 1, ids: [lastCommit + '^^'], moved: true });
    }
  }
  return next;
}

/**
 * Reconstruit les commits et leurs parents à partir de la sortie de
 * `git log --graph --oneline --all` en simulant les "lanes" dessinées par git.
 * Chaque lane mémorise les commits enfants qui attendent encore leur parent.
 */
export function parseGitGraph(raw: string): ParsedGraph {
  const commits: Commit[] = [];
  const byId = new Map<string, Commit>();
  const warnings: string[] = [];
  const branchTips = new Map<string, BranchRef>();
  let head: string | undefined;

  let lanes: Lane[] = [];
  let lastCommit: string | undefined;
  const parentRank = new Map<string, Map<string, number>>();

  const lines = raw.replace(ANSI, '').split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    const m = COMMIT_LINE.exec(line);
    if (m && m[1].includes('*')) {
      const [, prefix, id, decoration = '', subject] = m;
      const star = prefix.indexOf('*');
      const commit: Commit = { id, subject: subject.trim(), parents: [], tags: [] };

      const children = uniq(lanes.filter((l) => l.pos === star).flatMap((l) => l.ids));
      for (const marked of children) {
        const child = marked.replace(/\^+$/, '');
        const rank = marked.length - child.length;
        const c = byId.get(child);
        if (!c) continue;
        const ranks = (parentRank.get(child) ?? parentRank.set(child, new Map()).get(child)!);
        if (!c.parents.includes(id)) c.parents.push(id);
        ranks.set(id, Math.min(rank, ranks.get(id) ?? rank));
        c.parents.sort((a, b) => ranks.get(a)! - ranks.get(b)!);
      }

      // Une ligne de commit peut aussi contenir des décalages (`* /`) pour les autres lanes.
      const next = advance(
        lanes.filter((l) => l.pos !== star),
        prefix,
        undefined,
        true,
      );
      next.push({ pos: star, ids: [id], moved: false });
      lanes = next;
      lastCommit = id;

      for (const token of decoration.split(', ').map((t) => t.trim()).filter(Boolean)) {
        if (token.startsWith('tag: ')) {
          commit.tags.push(token.slice(5));
        } else if (token.startsWith('HEAD -> ')) {
          head = token.slice(8);
          branchTips.set(head, { name: head, tip: id, remote: false });
        } else if (token === 'HEAD' || token.endsWith('/HEAD') || token.startsWith('refs/')) {
          continue;
        } else {
          branchTips.set(token, { name: token, tip: id, remote: REMOTE_PREFIX.test(token) });
        }
      }

      commits.push(commit);
      byId.set(id, commit);
      return;
    }

    if (GRAPH_ONLY.test(line)) {
      lanes = advance(lanes, line, lastCommit);
      return;
    }

    // Ligne coupée par le retour à la ligne automatique du terminal : suite du message précédent.
    const previous = commits[commits.length - 1];
    if (previous && !/^[ |\\/_*.\-]/.test(line)) {
      previous.subject += line.trim();
      return;
    }

    warnings.push(`Ligne ${i + 1} ignorée : « ${line.slice(0, 80)} »`);
  });

  const branches = [...branchTips.values()].sort(
    (a, b) => Number(a.remote) - Number(b.remote) || a.name.localeCompare(b.name),
  );

  if (!commits.length) warnings.push('Aucun commit détecté dans le texte collé.');
  return { commits, byId, branches, head, warnings };
}
