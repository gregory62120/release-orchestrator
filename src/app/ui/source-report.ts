import { Component, computed, input, output } from '@angular/core';
import { ROLES, ROLE_LABEL, type Role } from '../core/models';
import { ROLE_CHIP } from '../core/role-style';
import type { SourceReport } from '../core/analysis';

@Component({
  selector: 'app-source-report',
  template: `
    <section class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h3 class="font-mono text-sm font-semibold text-slate-900">{{ report().name }}</h3>

        @if (report().kind === 'feature') {
          <label class="flex items-center gap-2 text-xs text-slate-500">
            part de
            <select
              class="rounded-md border-0 bg-white px-2 py-1 text-xs font-medium ring-1 ring-slate-300"
              [value]="report().root"
              (change)="rootChange.emit($any($event.target).value)"
            >
              @for (r of roles(); track r) {
                <option [value]="r" [selected]="r === report().root">
                  {{ label[r] }}{{ r === report().autoRoot ? ' (détecté)' : '' }}
                </option>
              }
            </select>
          </label>
        } @else {
          <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" [class]="chip[report().root]">
            {{ label[report().root] }}
          </span>
        }

        <span class="ml-auto text-xs" [class]="missingCount() ? 'font-semibold text-rose-600' : 'text-emerald-600'">
          {{ missingCount() ? missingCount() + ' commit(s) incomplet(s)' : 'Tout est cherry-pické' }}
          · {{ report().checks.length }} commit(s)
        </span>
      </header>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-2 font-medium">Commit</th>
              <th class="px-3 py-2 font-medium">Message</th>
              @for (t of report().targets; track t) {
                <th class="px-3 py-2 font-medium">→ {{ label[t] }}</th>
              }
              <th data-no-export class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (c of rows(); track c.commit.id) {
              <tr [class]="c.missing.length ? 'bg-rose-50/60' : ''">
                <td class="px-5 py-2 font-mono text-xs text-slate-500">{{ c.commit.id }}</td>
                <td class="max-w-md px-3 py-2 text-slate-800">{{ c.commit.subject }}</td>
                @for (t of c.targets; track t.role) {
                  <td class="whitespace-nowrap px-3 py-2">
                    @if (t.present) {
                      <span class="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">
                        ✓
                        <span class="font-mono">{{ t.byAncestry ? 'dans la branche' : t.matchId }}</span>
                      </span>
                    } @else {
                      <span class="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                        ✗ Manquant
                      </span>
                    }
                  </td>
                }
                <td data-no-export class="px-3 py-2 text-right">
                  @if (c.missing.length) {
                    <button
                      type="button"
                      title="Ne plus tenir compte de ce commit (ex : revert)"
                      (click)="ignoreCommit.emit(c.commit.id)"
                      class="cursor-pointer rounded-md px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-300 hover:bg-slate-100"
                    >
                      Ignorer
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class SourceReportView {
  readonly report = input.required<SourceReport>();
  readonly roles = input<Role[]>(ROLES);
  readonly onlyMissing = input(false);
  readonly rootChange = output<Role>();
  readonly ignoreCommit = output<string>();

  protected readonly label = ROLE_LABEL;
  protected readonly chip = ROLE_CHIP;

  protected readonly missingCount = computed(() => this.report().checks.filter((c) => c.missing.length).length);
  protected readonly rows = computed(() => {
    const checks = this.report().checks;
    return (this.onlyMissing() ? checks.filter((c) => c.missing.length) : checks).slice().reverse();
  });
}
