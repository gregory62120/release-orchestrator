import { Component } from '@angular/core';
import { input } from '@angular/core';
import type { VersionTimeline } from '../core/analysis';
import { CopyButton } from './copy-button';

@Component({
  selector: 'app-version-matrix',
  host: { class: 'block' },
  imports: [CopyButton],
  template: `
    <section class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h3 class="text-sm font-semibold text-slate-900">Versions par branche</h3>
        <span class="text-xs text-slate-500">{{ timeline().rows.length }} version(s)</span>
        <span class="ml-auto"><app-copy-button [table]="t" /></span>
      </header>
      <div class="overflow-x-auto">
        <table #t class="w-full text-left text-sm">
          <thead class="bg-slate-50/70 text-slate-700">
            <tr>
              <th class="px-5 py-3 font-semibold">Numéro de version</th>
              @for (c of timeline().columns; track c.key) {
                <th class="px-5 py-3 font-semibold">
                  {{ c.title }}
                  @if (c.branch) {
                    <span class="block font-mono text-[11px] font-normal text-slate-400">{{ c.branch }}</span>
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (r of timeline().rows; track r.tag) {
              <tr>
                <td class="px-5 py-2.5 font-medium text-slate-800">{{ r.tag }}</td>
                @for (v of r.cells; track $index) {
                  <td class="px-5 py-2.5 text-slate-700" [class]="v === r.tag ? 'bg-emerald-50 font-semibold text-emerald-800' : ''">
                    {{ v }}
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td class="px-5 py-4 text-sm text-slate-500" [attr.colspan]="timeline().columns.length + 1">
                  Aucun tag trouvé.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class VersionMatrix {
  readonly timeline = input.required<VersionTimeline>();
}
