import { Component, computed, input, signal } from '@angular/core';
import { ROLES, ROLE_LABEL, type Role } from '../core/models';
import { ROLE_CHIP } from '../core/role-style';
import type { Analysis } from '../core/analysis';
import type { RoleBranches } from '../core/models';

@Component({
  selector: 'app-todo-panel',
  template: `
    @if (blocks().length === 0) {
      <div class="rounded-xl bg-emerald-50 p-5 text-emerald-800 ring-1 ring-emerald-200">
        Tout est à jour : aucun cherry-pick à effectuer.
      </div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-3">
        @for (b of blocks(); track b.role) {
          <article class="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <header class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 overflow-hidden">
                <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" [class]="chip[b.role]">
                  {{ label[b.role] }}
                </span>
                <code class="truncate text-xs text-slate-500">{{ b.branch }}</code>
              </div>
              <span class="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                {{ b.commits.length }} à picker
              </span>
            </header>
            <pre class="mt-3 flex-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">{{ b.script }}</pre>
            <button
              data-no-export
              type="button"
              (click)="copy(b.role, b.script)"
              class="mt-3 cursor-pointer rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              {{ copied() === b.role ? 'Copié ✓' : 'Copier les commandes' }}
            </button>
          </article>
        }
      </div>
    }
  `,
})
export class TodoPanel {
  readonly analysis = input.required<Analysis>();
  readonly branches = input.required<RoleBranches>();
  protected readonly label = ROLE_LABEL;
  protected readonly chip = ROLE_CHIP;
  protected readonly copied = signal<Role | null>(null);

  protected readonly blocks = computed(() =>
    ROLES.filter((r) => this.analysis().todo[r].length).map((role) => {
      const commits = this.analysis().todo[role];
      const branch = this.branches()[role];
      const lines = commits.map((c) => `git cherry-pick -x ${c.id}   # ${c.subject}`);
      return { role, branch, commits, script: [`git checkout ${branch}`, ...lines].join('\n') };
    }),
  );

  protected async copy(role: Role, script: string) {
    try {
      await navigator.clipboard.writeText(script);
      this.copied.set(role);
      setTimeout(() => this.copied.set(null), 1500);
    } catch {
      // presse-papier indisponible : l'utilisateur peut sélectionner le texte
    }
  }
}
