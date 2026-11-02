// Build pour GitHub Pages : Angular génère les fichiers statiques dans `<output>/browser`,
// alors que Pages sert le dossier `docs/` à la racine. On compile, puis on remplace `docs/`.
import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = 'release-orchestrator'; // nom du dépôt GitHub = chemin du site (…github.io/<repo>/)
const output = join('dist', 'pages');
const docs = 'docs';

rmSync(output, { recursive: true, force: true });
execFileSync(
  'npx',
  ['ng', 'build', '--configuration', 'production', '--base-href', `/${repo}/`, '--output-path', output],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

const browser = join(output, 'browser');
if (!existsSync(join(browser, 'index.html'))) {
  throw new Error(`Build inattendu : ${browser}/index.html introuvable, docs/ n'a pas été touché.`);
}

// On ne vide pas docs/ : d'autres fichiers peuvent y vivre. On retire seulement les anciens fichiers
// du build (ceux qui portent le même nom que les nouveaux, et les anciens fichiers à hash).
const HASHED = /^(main|chunk|styles|polyfills|scripts|worker)-[\w-]+\.(js|css)$/;
mkdirSync(docs, { recursive: true });
const fresh = new Set(readdirSync(browser));
for (const name of readdirSync(docs)) {
  if (fresh.has(name) || HASHED.test(name) || name === '3rdpartylicenses.txt' || name === '404.html') {
    rmSync(join(docs, name), { recursive: true, force: true });
  }
}
cpSync(browser, docs, { recursive: true });
// Pages ne doit pas passer le site par Jekyll ; 404.html = repli SPA pour les URLs profondes.
writeFileSync(join(docs, '.nojekyll'), '');
copyFileSync(join(docs, 'index.html'), join(docs, '404.html'));
rmSync(output, { recursive: true, force: true });

console.log(`\n✔ ${docs}/ mis à jour (base href /${repo}/). Il ne reste qu'à commiter et pousser.`);
