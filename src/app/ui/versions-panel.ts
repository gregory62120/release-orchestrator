import { Component, input } from '@angular/core';
import { ROLE_LABEL } from '../core/models';
import { ROLE_BAR, ROLE_CHIP } from '../core/role-style';
import type { VersionInfo } from '../core/analysis';

@Component({
  selector: 'app-versions-panel',
  template: `
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      @for (v of versions(); track v.role) {
        <article class="rounded-xl border-l-4 bg-white p-5 shadow-sm ring-1 ring-slate-200" [class]="bar[v.role]">
          <div class="flex items-center justify-between">
            <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" [class]="chip[v.role]">
              {{ label[v.role] }}
            </span>
            <code class="truncate pl-2 text-xs text-slate-500" [title]="v.branch">{{ v.branch }}</code>
          </div>

          @if (v.lastTag) {
            <p class="mt-4 text-3xl font-bold tracking-tight text-slate-900">{{ v.lastTag }}</p>
            <p class="mt-1 text-sm" [class]="v.onTag ? 'text-emerald-600' : 'text-slate-500'">
              @if (v.onTag) {
                La branche est exactement sur cette version
              } @else {
                +{{ v.commitsSince }} commit{{ v.commitsSince > 1 ? 's' : '' }} depuis cette version
              }
            </p>
            @if (v.recentTags.length > 1) {
              <div class="mt-4 flex flex-wrap gap-1.5">
                @for (t of v.recentTags.slice(1); track t) {
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{{ t }}</span>
                }
              </div>
            }
          } @else {
            <p class="mt-4 text-lg font-semibold text-slate-400">Aucun tag trouvé</p>
            <p class="mt-1 text-sm text-slate-500">
              Les tags apparaissent avec <code>--decorate</code> dans le git log.
            </p>
          }
        </article>
      }
    </div>
  `,
})
export class VersionsPanel {
  readonly versions = input.required<VersionInfo[]>();
  protected readonly label = ROLE_LABEL;
  protected readonly chip = ROLE_CHIP;
  protected readonly bar = ROLE_BAR;
}
