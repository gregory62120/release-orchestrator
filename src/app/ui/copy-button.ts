import { Component, input, signal } from '@angular/core';
import { copyTable } from '../core/copy-table';

@Component({
  selector: 'app-copy-button',
  // Le bouton n'a rien à faire dans les exports PDF / image.
  host: { 'data-no-export': '' },
  template: `
    <button
      type="button"
      (click)="copy()"
      class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium shadow-sm ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      [class]="
        state() === 'done'
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-300'
          : state() === 'error'
            ? 'bg-rose-50 text-rose-700 ring-rose-300'
            : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'
      "
    >
      @if (state() === 'done') {
        <svg class="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
            clip-rule="evenodd"
          />
        </svg>
        Copié
      } @else if (state() === 'error') {
        Copie impossible
      } @else {
        <svg class="size-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M7 3a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7Zm6 11V8a2 2 0 0 0-2-2H7V5h7v7h-1Z" />
        </svg>
        Copier le tableau
      }
    </button>
  `,
})
export class CopyButton {
  /** Le `<table>` à copier (via une référence de template : `<table #t>` puis `[table]="t"`). */
  readonly table = input.required<HTMLTableElement>();
  protected readonly state = signal<'idle' | 'done' | 'error'>('idle');

  protected async copy() {
    try {
      await copyTable(this.table());
      this.state.set('done');
    } catch {
      this.state.set('error');
    }
    setTimeout(() => this.state.set('idle'), 1800);
  }
}
