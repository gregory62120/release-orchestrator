import { Component, computed, ElementRef, signal, viewChild } from '@angular/core';
import { analyze, suggestBranches } from './core/analysis';
import { exportReport, type ExportFormat } from './core/export-report';
import { parseGitGraph } from './core/graph-parser';
import { ROLES, ROLE_LABEL, type ParsedGraph, type Role, type RoleBranches } from './core/models';
import { ROLE_CHIP } from './core/role-style';
import { ReleasesTable } from './ui/releases-table';
import { SourceReportView } from './ui/source-report';
import { TodoPanel } from './ui/todo-panel';
import { VersionsPanel } from './ui/versions-panel';

const PLACEHOLDER = `*   1824a97 (HEAD -> develop) Merge feature/x
|\\
| * bcb941c (feature/hotfix-pdf) fix: pdf marges
| * d8696ff (patch/1.0) fix: crash au demarrage
...`;

const STORAGE_KEY = 'release-orchestrator.ignored-commits';

function loadIgnored(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

@Component({
  selector: 'app-root',
  imports: [VersionsPanel, ReleasesTable, TodoPanel, SourceReportView],
  templateUrl: './app.html',
})
export class App {
  protected readonly roles = ROLES;
  protected readonly label = ROLE_LABEL;
  protected readonly chip = ROLE_CHIP;
  protected readonly placeholder = PLACEHOLDER;

  protected readonly raw = signal('');
  protected readonly graph = signal<ParsedGraph | null>(null);
  protected readonly selection = signal<RoleBranches>({ tnr: '', patch: '', dev: '' });
  protected readonly overrides = signal<Record<string, Role>>({});
  protected readonly onlyMissing = signal(true);
  private readonly report = viewChild<ElementRef<HTMLElement>>('report');
  protected readonly exporting = signal(false);
  protected readonly today = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
  protected readonly formats: { id: ExportFormat; label: string }[] = [
    { id: 'pdf', label: 'PDF' },
    { id: 'png', label: 'Image PNG' },
    { id: 'jpeg', label: 'Image JPEG' },
  ];
  protected readonly ignoreText = signal('');
  protected readonly ignoredIds = signal<Set<string>>(loadIgnored());
  protected readonly ignoredCommits = computed(() => {
    const g = this.graph();
    return g ? [...this.ignoredIds()].map((id) => g.byId.get(id)).filter((c) => !!c) : [];
  });
  protected readonly keywords = computed(() =>
    this.ignoreText()
      .split(/[,;\n]/)
      .map((k) => k.trim())
      .filter(Boolean),
  );

  private readonly chosen = computed(() => ROLES.map((r) => this.selection()[r]).filter(Boolean));

  protected readonly ready = computed(
    () => !!this.selection().dev && new Set(this.chosen()).size === this.chosen().length,
  );

  protected readonly duplicate = computed(() => new Set(this.chosen()).size !== this.chosen().length);

  protected readonly analysis = computed(() => {
    const g = this.graph();
    return g && this.ready() ? analyze(g, this.selection(), this.overrides(), this.keywords(), this.ignoredIds()) : undefined;
  });

  protected readonly incomplete = computed(
    () => this.analysis()?.sources.filter((s) => s.checks.some((c) => c.missing.length)).length ?? 0,
  );

  protected parse() {
    const g = parseGitGraph(this.raw());
    this.graph.set(g);
    this.overrides.set({});
    const s = suggestBranches(g);
    this.selection.set({ tnr: s.tnr ?? '', patch: s.patch ?? '', dev: s.dev ?? '' });
  }

  protected pick(role: Role, name: string) {
    this.selection.update((s) => ({ ...s, [role]: name }));
  }

  protected async export(format: ExportFormat) {
    const el = this.report()?.nativeElement;
    if (!el) return;
    this.exporting.set(true);
    try {
      await exportReport(el, format, `rapport-release-${new Date().toISOString().slice(0, 10)}`);
    } catch (e) {
      alert(`Export impossible : ${e instanceof Error ? e.message : e}`);
    } finally {
      this.exporting.set(false);
    }
  }

  protected ignoreCommit(id: string) {
    this.updateIgnored((s) => s.add(id));
  }

  protected restoreCommit(id: string) {
    this.updateIgnored((s) => s.delete(id));
  }

  private updateIgnored(change: (s: Set<string>) => unknown) {
    const next = new Set(this.ignoredIds());
    change(next);
    this.ignoredIds.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // stockage indisponible : le choix ne vaut que pour cette session
    }
  }

  protected setRoot(branch: string, role: Role) {
    this.overrides.update((o) => ({ ...o, [branch]: role }));
  }

  protected async loadFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.raw.set(await file.text());
  }
}
