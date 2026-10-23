# Recette de livraison : Believe, 23 octobre 2026

Portée : la dernière étape (rappels de tâches, dictée vocale, textes légaux, page d'état) et la vérification finale de l'ensemble de l'application. Tous les résultats viennent de commandes réellement exécutées sur le code livré, dans un conteneur Linux (Node, Chromium sans écran), **sans téléphone, sans micro, sans clé d'API et sans accès aux services de Google**. Quatre issues sont distinguées : **réussi**, **échoué puis corrigé**, **bloqué** (impossible depuis cet environnement) et **non exécuté**.

## 1. Contrôles exécutés sur le code livré

| Contrôle | Commande | Résultat |
|---|---|---|
| Compilation TypeScript (application et fonctions serveur) | `npm run typecheck` | réussi |
| Tests d'interface et de modules (jsdom) | `npm test` | réussi : 15 fichiers, 248 tests |
| Audit : calculs, migration des données, import, persistance, PIN, IndexedDB, fonctions serveur avec appels simulés, rappels, dictée | `TZ=… npm run audit` | réussi : 182 sur 182 dans Europe/Paris, America/Los_Angeles et Pacific/Auckland |
| Contrastes WCAG des trois thèmes | `node scripts/contrast.mjs` | réussi : texte ≥ 4,5:1, graphiques ≥ 3:1 |
| Versets bibliques | `npm run verify:verses` | réussi : 57 versets (28 pour Femme, 29 pour Homme) identiques mot pour mot à la Bible Louis Segond 1910 ou à la Bible Martin 1744, selon la traduction indiquée pour chaque verset (éditions fournies en fichiers : le téléchargement n'est pas possible depuis cet environnement) |
| Construction de la PWA | `npm run build` | réussi : 29 fichiers précachés (612 Kio) |
| Parcours dans un vrai Chromium (faux micro, vrai service worker, IndexedDB réel, CSP appliquée, hors ligne, balayages, accessibilité axe-core WCAG 2.1 AA dans trois thèmes) | `npm run build && npm run e2e` | réussi : 70 sur 70 |

## 2. Défauts trouvés pendant cette étape

« Nature » distingue un défaut du **code** de l'application, un défaut d'un **test** (test manquant, instable ou faux) et un défaut de **texte** (page légale, page d'état).

| Nature | Fonctionnalité | Constat | Correction | Test de confirmation |
|---|---|---|---|---|
| Code | Rappels, clic sur la notification | L'adresse portée par la notification n'était contrôlée que par « commence par / » : une adresse comme `//autre-site` aurait été acceptée | Seules les adresses du site sont suivies, sinon retour à la rubrique 9 (`public/sw-notify.js`) | `src/swnotify.test.tsx` (20 tests) ; 15 défauts volontaires détectés |
| Test | Rappels, retour au premier plan | Aucun test isolé ne vérifiait le contrôle au retour dans l'application (un défaut volontaire survivait) | Test isolé du détecteur | Défaut volontaire H11 détecté |
| Test | Rappels, parcours Chromium | Instable dans quelques pour cent des essais : la liste des notifications du système est parfois vide juste après l'affichage (Chromium sans écran) | Le test s'appuie sur le journal des appels de l'application ; la liste du système n'est qu'une vérification souple, signalée par une note | Deux exécutions complètes de la suite : 70 sur 70 chacune |
| Test | Dictée, résultat vide | Rien ne vérifiait qu'un résultat définitif vide n'est pas annoncé « Texte dicté ajouté » (un défaut volontaire survivait) | Test ajouté | Défaut volontaire D14 détecté |
| Code | Dictée, lecteurs d'écran | Le bouton portait à la fois un état « appuyé » et un libellé qui change : annonce contradictoire | État « appuyé » retiré, le libellé seul (« Dicter » / « Arrêter la dictée ») | Test ; défauts volontaires A14a, A14b |
| Code | Dictée, clavier | Le focus se perdait à l'ouverture et à la fermeture de la carte d'accord | Focus sur le titre de la carte, retour sur le bouton de dictée | Tests jsdom et Chromium ; défauts volontaires F1 à F6, DE6, DE7 |
| Code | Dictée, après l'envoi | Les messages « Texte dicté ajouté… », « question trop longue » et une ancienne erreur de micro restaient affichés après l'envoi de la question | Effacés à l'envoi | 2 tests ; défauts volontaires N1 à N3 |
| Test | Audit | Un état d'essai sans l'accord « dictée », et une hypothèse fausse de ma part (le schéma tolère volontairement les clés inconnues pour lire des données plus récentes) | Corrigés ; contrôle plus strict : chaque accord refuse toute valeur non booléenne | Audit 182 sur 182 ; défaut volontaire L2 détecté par l'audit |
| Test | Parcours Chromium de la dictée | Chromium récent expose aussi le nom standard `SpeechRecognition` : le moteur simulé n'était pas utilisé ; le champ était lu avant son affichage | Moteur simulé sous les deux noms ; attente de la valeur | Parcours réussi ; 12 défauts volontaires détectés |
| Test | Parcours Chromium des premières rubriques | Le défaut volontaire « référence de verset altérée » n'est pas vu par ce parcours, qui compare l'affichage à la liste du code elle-même | Contrôle assuré par d'autres tests : `src/verses.test.tsx` et `npm run verify:verses` le détectent (vérifié) | Défaut V9 détecté par les tests d'interface |
| Texte | Page d'état | Textes périmés (« reconnaissance vocale non implémentée », « pas de notifications système ») ; rubriques 1, 2, 4 et 6 encore marquées « partielles » alors que leurs éléments du cahier des charges sont faits | Réécrite avec les limites réelles | Tests ; défauts volontaires S1 à S4 |
| Texte | Pages légales | Dictée vocale (où part le son) et rappels absents ou imprécis | Complétées (principe, tableau des données, destinataires) | Tests ; défauts volontaires L3 à L8 |
| Test | Audit, cycle et compteurs des fonctions serveur | Le rejeu final des défauts volontaires a montré deux défauts que l'audit ne voyait pas : le seuil de trois notes par phase du cycle (aucun cas avec exactement deux notes) et le nom de route du compteur quotidien partagé des images (seul celui des livres était contrôlé) | Cas à deux notes ajouté ; nouveau test des noms de route des compteurs des quatre fonctions serveur (ai, ext, yt, img) | Audit 182 sur 182 dans trois fuseaux ; défauts volontaires S19, I2 et K1 à K4 détectés |

## 3. Qualité des tests : défauts introduits volontairement

`scripts/mutation/run.py` remplace un morceau de code par une version fautive, lance les tests visés et remet le code d'origine : le défaut doit faire échouer au moins un test. 360 défauts sont décrits dans `scripts/mutation/specs/` (liste et mode d'emploi dans le README). **Les 360 ont été rejoués le 23 octobre sur le code de l'application tel que livré (et, pour les séries d'audit, avec l'audit tel que livré) ; tous sont détectés**, aux précisions suivantes près :

- ce rejeu a trouvé deux défauts que l'audit ne voyait pas (seuil de trois notes par phase du cycle ; nom de route du compteur partagé des images) : voir la section 2. L'audit a été complété, puis toutes les séries d'audit ont été rejouées avec le nouvel audit ;
- les défauts de fuseau horaire ne se voient que dans certains fuseaux : T1 (jours du cycle en heure locale) à Paris et à Auckland, T2 et T3 (dates sans UTC) à Los Angeles, M20 (jour calendaire des rappels calculé en UTC) à Los Angeles et à Auckland ;
- le défaut L2 (validation de l'accord au chargement) n'est vu que par l'audit, pas par les tests d'interface ;
- la référence de verset altérée n'est pas vue par le parcours Chromium (qui compare l'affichage à la liste du code), mais par les tests d'interface et par `verify:verses` ;
- un défaut équivalent (V8, fenêtre du verset non fermée au verrouillage) a été retiré : il ne change aucun comportement visible, le déverrouillage rouvrant de toute façon la fenêtre non fermée.

Un défaut détecté prouve qu'un test le voit ; cela ne prouve pas l'absence d'autres défauts.

## 4. Bloqué ou non exécuté

| Élément | Statut | Raison |
|---|---|---|
| Installation et usage sur un vrai Android ou iPhone (PWA, notifications du système, GPS, podomètre, vibration, micro) | non exécuté | aucun appareil disponible |
| Dictée avec une vraie voix, et sur Safari ou iPhone | bloqué | pas de micro ni d'appareil ; le vrai moteur de Chromium a été lancé sans micro : il répond « aucun micro » et l'application affiche son message sans se figer |
| Appels réels à Gemini (texte, photos, image du plat) | bloqué | pas de clé d'API ni d'accès au service ; réponses simulées pour vérifier les requêtes et le contrôle des réponses |
| YouTube Data API et catalogues de livres (Open Library, Google Books, Project Gutenberg, LibriVox) | bloqué | réseau limité ; analyseurs vérifiés sur des réponses simulées |
| Compteurs partagés Upstash / Vercel KV | non exécuté | pas de compte |
| Déploiement réel sur Vercel (HTTPS, fonctions serveur) | non exécuté | à faire par vous |
| Rappels application fermée (Web Push) | non implémenté | demande un serveur de notifications et des abonnements |
| Cercle d'amis par invitation (option Cloud / Supabase) | non implémenté | le partage avec des amis est local : carte image et texte que vous envoyez vous-même |
| Chiffrement des données par le PIN | non fourni | le PIN verrouille l'interface, il ne chiffre pas le stockage du navigateur |

## 5. À faire de votre côté

1. Renseigner `PUBLISHER` (nom, contact) dans `src/legal.ts` avant toute mise en ligne publique, et faire relire les pages légales par un juriste.
2. Déployer sur Vercel et définir `GEMINI_API_KEY` (et `ACCESS_CODE`) ; voir le README pour les autres variables.
3. Essayer sur de vrais téléphones : installation, dictée avec votre voix, « Tester une notification » (rubrique 9), image du plat (service payant : vérifier le nom du modèle et le tarif chez Google).

## 6. Limites connues

- Un rappel de tâche n'est donné que pendant que Believe est ouvert ; application fermée, seul l'export `.ics` fait alerter votre agenda.
- La dictée vocale utilise la reconnaissance du navigateur : sur Chrome et Safari, le son part chez Google ou Apple (dit avant l'accord) ; elle est absente de Firefox.
- La liste des versets (28 pour Femme, 29 pour Homme) est une sélection reconstituée, vérifiée mot pour mot sur des éditions du domaine public ; elle peut être complétée dans `src/verses.ts`, `npm run verify:verses` contrôlant chaque ajout.
- Le mode d'emploi pour rejouer les contrôles est dans le README (« Démarrer » et « Défauts introduits volontairement »).
