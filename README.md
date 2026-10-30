# release-orchestrator

Angular 22 + Tailwind CSS 4. Analyse un `git log --graph --oneline --all --decorate` et vérifie les cherry-picks
entre les branches TNR, Patch et Dev :

- tout commit TNR doit se retrouver sur Patch et Dev ;
- tout commit Patch doit se retrouver sur Dev ;
- tout commit d'une autre branche doit aller sur sa branche racine (TNR, Patch ou Dev), puis suivre la règle ci-dessus.

Un cherry-pick est reconnu par l'identité du message de commit (le graph ne contient pas les diffs).

## Lancer

Nécessite Node >= 22.22.3 ou >= 24.15.

```bash
npm install
npm start
```
