import { Component, input } from '@angular/core';
import { ROLE_LABEL } from '../core/models';
import { ROLE_CHIP } from '../core/role-style';
import type { VersionInfo } from '../core/analysis';

const MAX_COMMITS_SHOWN = 6;

@Component({
  selector: 'app-releases-table',
  template: `
    <div class="space-y-5">
      @for (v of versions(); track v.role) {
        <section class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1" [class]="chip[v.role]">
              {{ label[v.role] }}
            </span>
            <code class="text-sm font-semibold text-slate-900">{{ v.branch }}</code>
            @if (v.lastTag) {
              <span class="ml-auto rounded-lg bg-emerald-600 px-3 py-1 text-sm font-bold text-white">
                Dernière version : {{ v.lastTag }}
              </span>
            }
          </header>

          @if (v.history.length) {
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="w-64 px-5 py-2 font-medium">Version</th>
                  <th class="w-24 px-3 py-2 font-medium">Commit</th>
                  <th class="px-3 py-2 font-medium">Commits livrés</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @if (v.pending.length) {
                  <tr class="bg-slate-50/70">
                    <td class="px-5 py-2 align-top italic text-slate-500">Non livré (depuis {{ v.lastTag }})</td>
                    <td class="px-3 py-2 align-top font-mono text-xs text-slate-500">{{ v.tip }}</td>
                    <td class="px-3 py-2 align-top">
                      <span class="font-medium text-slate-700">{{ v.pending.length }} commit(s)</span>
                      <ul class="mt-1 space-y-0.5 text-xs text-slate-600">
                        @for (c of v.pending.slice(0, max); track c.id) {
                          <li>· {{ c.subject }}</li>
                        }
                        @if (v.pending.length > max) {
                          <li class="text-slate-400">… et {{ v.pending.length - max }} autre(s)</li>
                        }
                      </ul>
                    </td>
                  </tr>
                }
                @for (h of v.history; track h.commitId) {
                  <tr [class]="h.latest ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-300' : ''">
                    <td class="px-5 py-2 align-top">
                      <span [class]="h.latest ? 'text-base font-bold text-emerald-700' : 'font-semibold text-slate-800'">
                        {{ h.tag }}
                      </span>
                      @if (h.latest) {
                        <span class="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Dernière
                        </span>
                      }
                      @for (t of h.otherTags; track t) {
                        <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{{ t }}</span>
                      }
                    </td>
                    <td class="px-3 py-2 align-top font-mono text-xs text-slate-500">{{ h.commitId }}</td>
                    <td class="px-3 py-2 align-top">
                      @if (h.initial) {
                        <span class="text-xs text-slate-400">Plus ancienne version du graph</span>
                      } @else if (!h.commits.length) {
                        <span class="text-xs text-slate-400">Aucun commit fonctionnel</span>
                      } @else {
                        <span class="font-medium text-slate-700">{{ h.commits.length }} commit(s)</span>
                        <ul class="mt-1 space-y-0.5 text-xs text-slate-600">
                          @for (c of h.commits.slice(0, max); track c.id) {
                            <li>· {{ c.subject }}</li>
                          }
                          @if (h.commits.length > max) {
                            <li class="text-slate-400">… et {{ h.commits.length - max }} autre(s)</li>
                          }
                        </ul>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="px-5 py-4 text-sm text-slate-500">Aucun tag trouvé sur cette branche.</p>
          }
        </section>
      }
    </div>
  `,
})
export class ReleasesTable {
  readonly versions = input.required<VersionInfo[]>();
  protected readonly max = MAX_COMMITS_SHOWN;
  protected readonly label = ROLE_LABEL;
  protected readonly chip = ROLE_CHIP;
}
