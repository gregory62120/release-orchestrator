import { Component, computed, input } from '@angular/core';
import { ROLE_LABEL, type Role, type RoleBranches } from '../core/models';
import { ROLE_CHIP } from '../core/role-style';
import { normalizeSubject, type CommitCheck, type SourceReport } from '../core/analysis';
import { CopyButton } from './copy-button';

interface Column {
  key: string;
  title: string;
  branch: string;
  role?: Role;
}

interface Cell {
  subject?: string;
  missing: boolean;
}

/** Ordre d'affichage des colonnes : dev, TNR, patch. */
const COLUMN_ORDER: Role[] = ['dev', 'tnr', 'patch'];

@Component({
  selector: 'app-commit-matrix',
  host: { class: 'block' },
  imports: [CopyButton],
  template: `
    <section class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h3 class="text-sm font-semibold text-slate-900" [class.font-mono]="role()">{{ title() }}</h3>
        @if (role(); as r) {
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" [class]="chip[r]">
            {{ label[r] }}
          </span>
        }
        <span class="text-xs text-slate-500">{{ rows().length }} commit(s)</span>
        <span class="ml-auto"><app-copy-button [table]="t" /></span>
      </header>

      <div class="overflow-x-auto">
        <table #t class="w-full table-fixed text-left text-sm">
          <thead class="bg-slate-50/70 text-slate-700">
            <tr>
              <th class="px-5 py-3 font-semibold">Nom du commit</th>
              @for (c of columns(); track c.key) {
                <th class="px-5 py-3 font-semibold">
                  {{ c.title }}
                  <span class="block font-mono text-[11px] font-normal text-slate-400">{{ c.branch }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (r of rows(); track r.key) {
              <tr>
                <td class="px-5 py-3 align-top text-slate-800">{{ r.subject }}</td>
                @for (cell of r.cells; track $index) {
                  <td class="px-5 py-3 align-top" [class]="cell.missing ? 'bg-rose-50/60' : 'text-slate-800'">
                    {{ cell.subject }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class CommitMatrix {
  /** Une branche pour le tableau détaillé, toutes les branches pour le récapitulatif. */
  readonly reports = input.required<SourceReport[]>();
  readonly title = input.required<string>();
  /** Rôle affiché en pastille à côté du titre (tableau d'une seule branche). */
  readonly role = input<Role>();
  readonly roles = input.required<Role[]>();
  readonly branches = input.required<RoleBranches>();

  protected readonly label = ROLE_LABEL;
  protected readonly chip = ROLE_CHIP;

  protected readonly columns = computed<Column[]>(() => {
    const cols: Column[] = COLUMN_ORDER.filter((role) => this.roles().includes(role)).map((role) => ({
      key: role,
      title: `sur ${ROLE_LABEL[role]}`,
      branch: this.branches()[role],
      role,
    }));
    // Une feature a sa propre colonne : c'est là que le commit a été fait.
    for (const r of this.reports()) {
      if (r.kind === 'feature') cols.push({ key: `f:${r.name}`, title: 'branche source', branch: r.name });
    }
    return cols;
  });

  /** Un commit présent dans plusieurs branches (cherry-picks) n'occupe qu'une ligne. */
  protected readonly rows = computed(() => {
    const cols = this.columns();
    const byKey = new Map<string, { key: string; subject: string; cells: Cell[] }>();
    for (const report of this.reports()) {
      // Du plus récent au plus ancien, comme le détail par branche.
      for (const check of report.checks.slice().reverse()) {
        const key = normalizeSubject(check.commit.subject);
        const cells = cols.map((c) => this.cell(report, check, c));
        const row = byKey.get(key);
        if (!row) byKey.set(key, { key, subject: check.commit.subject, cells });
        else row.cells = row.cells.map((c, i) => this.merge(c, cells[i]));
      }
    }
    return [...byKey.values()];
  });

  private merge(a: Cell, b: Cell): Cell {
    const subject = a.subject ?? b.subject;
    return { subject, missing: !subject && (a.missing || b.missing) };
  }

  private cell(report: SourceReport, check: CommitCheck, col: Column): Cell {
    if (!col.role) return report.kind === 'feature' && col.branch === report.name ? { subject: check.commit.subject, missing: false } : { missing: false };
    // Branche racine d'une branche de rôle : le commit y est par définition.
    if (report.kind === 'role' && col.role === report.root) return { subject: check.commit.subject, missing: false };
    const target = check.targets.find((t) => t.role === col.role);
    if (!target) return { missing: false };
    return { subject: target.matchSubject, missing: !target.present };
  }
}
