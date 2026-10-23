#!/usr/bin/env python3
"""Défauts introduits volontairement : éprouve les tests eux-mêmes.

Chaque ligne d'une spécification est  [nom, fichier, texte exact à remplacer, remplacement, tests à lancer].
Le script remplace le texte dans le fichier (une seule occurrence exigée), lance les tests indiqués, puis remet le fichier d'origine quoi qu'il arrive.
Un défaut est « DÉTECTÉ » si au moins un de ces tests échoue, « SURVÉCU » sinon (un test manque). Résultat attendu : DÉTECTÉ partout.

  python3 scripts/mutation/run.py scripts/mutation/specs/dictee.json [filtre-sur-le-nom]

« tests » :  ["src/x.test.tsx", …]   fichiers vitest ;
             ["@audit"]              scripts/audit.mjs ;
             ["@e2e", "regex"]       reconstruit l'application puis lance les parcours Chromium dont le titre correspond (scripts/e2e.mjs ; le port 4173 doit être libre).
Les défauts des fichiers *-fuseaux.json dépendent du fuseau horaire : jouez-les dans trois fuseaux (TZ=Europe/Paris, TZ=America/Los_Angeles, TZ=Pacific/Auckland) ; chacun doit être détecté dans au moins un.
Ne modifiez aucun fichier pendant une série (il est remplacé puis restauré). Code de sortie 1 si un défaut survit, si une ancre est introuvable ou si un parcours ne donne aucun résultat.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)


def verdict(tests):
    """Lance les tests visés et renvoie (détecté ?, résumé de l'échec)."""
    if tests == ['@audit']:
        r = subprocess.run(['node', 'scripts/audit.mjs'], capture_output=True, text=True, timeout=900)
        return r.returncode != 0, next((l for l in r.stdout.splitlines() if l.startswith('ÉCHEC')), '')[:200]
    if tests and tests[0] == '@e2e':
        sh('npm run build 2>&1 | tail -n 3')
        r = subprocess.run('node scripts/e2e.mjs', shell=True, capture_output=True, text=True, env=dict(os.environ, ONLY=tests[1]), timeout=900)
        ko = [l for l in r.stdout.splitlines() if l.startswith('ÉCHEC')]
        ok = [l for l in r.stdout.splitlines() if l.startswith('OK')]
        if not ko and not ok:
            return None, 'aucun parcours exécuté'
        return bool(ko), (ko[0][:200] if ko else '')
    r = subprocess.run(['npx', 'vitest', 'run'] + tests, capture_output=True, text=True, timeout=900)
    return r.returncode != 0, ''


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    spec = json.load(open(sys.argv[1], encoding='utf8'))
    only = sys.argv[2] if len(sys.argv) > 2 else None
    bad, rebuilt, ran = [], False, 0
    try:
        for name, f, old, new, tests in spec:
            if only and not re.search(only, name):
                continue
            src = open(f, encoding='utf8').read()
            if src.count(old) != 1:
                print('ANCRE INTROUVABLE (%d) : %s' % (src.count(old), name), flush=True)
                bad.append(name)
                continue
            open(f, 'w', encoding='utf8').write(src.replace(old, new))
            try:
                caught, why = verdict(tests)
                rebuilt = rebuilt or tests[0] == '@e2e'
            finally:
                open(f, 'w', encoding='utf8').write(src)
            ran += 1
            print(('DÉTECTÉ   ' if caught else ('SURVÉCU   ' if caught is False else 'SANS RÉSULTAT   ')) + name + ((' | ' + why) if why and not caught else ''), flush=True)
            if not caught:
                bad.append(name)
    finally:
        if rebuilt:
            sh('npm run build 2>&1 | tail -n 2')  # remet l'application d'origine dans dist/
    print('\n%d défaut(s) joué(s), %d non détecté(s) ou non jouable(s)' % (ran, len(bad)))
    sys.exit(1 if bad else 0)


main()
