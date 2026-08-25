# Suivi des travaux — Membres & Service Social

Dernière mise à jour : 25 août 2026 (2ᵉ passe).

Ce fichier suit le chantier ouvert après l'audit du 25 août 2026 : trois
défauts signalés sur la partie **Membres**, et la refonte de la partie
**Service Social** en caisses annuelles.

---

## A. Partie Membres

### A1 — Ordre des matricules dans l'annuaire ✅ TERMINÉ

**Demande.** Ranger les membres par le numéro d'ordre contenu dans le
matricule — dans `1ME 19-016 P`, c'est le `016` (16ᵉ membre enregistré),
et la lettre finale s'incrémente au même rythme.

**Ce qui n'allait pas.** Deux choses, empilées :

1. L'API triait par **nom alphabétique** ; le navigateur retriait ensuite
   par numéro. Tant que tous les membres tenaient sur une page, le
   résultat restait juste — mais l'API plafonne à 100 lignes
   (`crud.service.js#MAX_LIMIT`) et l'écran n'avait aucune pagination :
   au 101ᵉ membre, la liste aurait été tronquée en silence et l'ordre
   serait devenu incohérent, sans message.
2. **Deux lettres de contrôle étaient fausses en base** — c'est ce qui se
   voyait réellement. Les numéros s'enchaînaient parfaitement (1 → 62,
   aucun trou, aucun doublon), mais :
   - `1OL24061J` → devait être `1OL24061I`
   - `1OL21062K` → devait être `1OL21062J`

   Elles avaient été saisies à la main depuis l'administration, et rien
   ne vérifiait la lettre.

**Ce qui a été fait.**

- Nouveau champ dérivé `Member.registrationOrder` (le `016`), recalculé
  automatiquement à chaque écriture du matricule, sur les deux chemins
  (`save()` et `findOneAndUpdate()`), plus un index
  `{ church, registrationOrder }`.
- Tri **côté serveur** : `defaultSort: { church, registrationOrder, lastName }`.
  Le retri côté navigateur a été supprimé — il ne réordonnait qu'une page.
- Pagination réelle dans `AdminCrud` (50 lignes/page pour les membres),
  avec navigation entre pages : plus de troncature silencieuse.
- Le modèle **refuse** désormais un matricule dont la lettre ne
  correspond pas au numéro, avec un message qui donne la lettre attendue.
  Il refuse plutôt que de corriger en silence : une lettre fausse peut
  aussi signaler une faute de frappe dans le *numéro*.
- L'export Excel/PDF des membres trie sur le même champ (une seule
  implémentation au lieu de trois).

**Reprises de données appliquées en production :**

| Script | Effet | État |
|---|---|---|
| `backfillRegistrationOrder.js --apply` | 62 membres dotés de leur numéro d'ordre | ✅ appliqué |
| `fixRegistrationControlLetters.js --apply` | 2 lettres corrigées | ✅ appliqué |

**Vérifié :** séquence 001 A → 026 Z → 027 A → 062 J, strictement
croissante, 0 lettre incohérente.

---

### A2 — « Les données envoyées sont invalides » sans explication ✅ TERMINÉ

**Ce qui n'allait pas.** Le serveur renvoyait déjà le détail champ par
champ (`error.details`), mais `useCrud` le jetait et `AdminForm`
n'affichait que le message générique. L'administrateur ne savait jamais
quel champ refusait.

Déclencheur le plus fréquent : le **matricule**. La liste l'affiche mis
en forme (`1OL 25-045 S`), le formulaire n'appliquait qu'un `trim()`, et
le modèle exige la forme sans espace. Un copier-coller échouait donc.

**Ce qui a été fait.**

- Le détail par champ remonte jusqu'au formulaire : message sous le
  champ fautif, bordure rouge, `aria-invalid`. Les messages ne
  correspondant à aucun champ affiché sont listés en tête.
- Le matricule est normalisé à la saisie (`normalizeRegistrationNumber`) :
  espaces et tirets acceptés.

---

### A3 — Photo déformée sur la fiche membre ✅ TERMINÉ

**Ce qui n'allait pas.** Deux défauts distincts :

1. **Fiche membre PDF** — `doc.image()` recevait `width` **et** `height`,
   ce qui fait *étirer* l'image par PDFKit sans respecter ses
   proportions. C'était la déformation visible.
2. **Carte de membre** — le cadre du gabarit est *portrait*
   (63,8 × 80,76), mais la photo était recadrée en *carré*, puis
   re-recadrée par le SVG en `slice` centré. Double recadrage aux
   ancrages contradictoires → têtes coupées.

**Ce qui a été fait.**

- Fiche PDF : `cover: [l, h]` + `valign: "top"` — recadrage, plus
  d'étirement.
- Carte : la photo est produite directement **au rapport du cadre lu
  dans le gabarit**, ancrée en haut. Le `slice` du SVG n'a plus rien à
  retirer. Le repli « initiales » suit le même rapport.
- L'aperçu du formulaire est passé en portrait pour refléter le cadre
  réel : on voit enfin ce qu'on obtient.

---

### A4 — Notes internes effacées à chaque modification ✅ TERMINÉ

*Non signalé, trouvé pendant l'audit.*

`notes` est `select: false` : l'API ne le renvoyait jamais, le formulaire
affichait un champ vide et le réenvoyait tel quel. **Chaque
enregistrement d'un membre effaçait ses notes pastorales, en silence.**

Corrigé par une option `adminSelect: "+notes"` sur la ressource membres
(lecture d'administration uniquement, route déjà réservée admin/editor).

---

### A5 — Validation d'inscription bloquée par un matricule fautif ✅ TERMINÉ

*Signalé pendant le chantier. Le défaut est antérieur aux corrections
ci-dessus.*

**Ce qui n'allait pas.** Une demande en attente refusait de se valider
avec « Les données envoyées sont invalides. » Le matricule saisi par le
membre était `10L24061J` : **un zéro à la place de la lettre O**. Le
matricule ne correspondait donc à aucune fiche, le pré-remplissage
public ne le retrouvait pas, et l'erreur ne disait ni quel champ était
en cause ni quoi corriger. Aucun moyen, non plus, de rectifier le
matricule depuis le panneau de validation : la demande était bloquée
définitivement.

**Ce qui a été fait.**

- `normalizeRegistrationNumber` répare les confusions `O`/`0` et `I`/`1`
  **par position**. La correction est déterministe, pas une supposition :
  le format impose la nature de chaque caractère, donc un `0` en
  position de lettre ne peut être qu'un `O`. Appliqué uniquement sur une
  chaîne de 9 caractères, pour ne pas abîmer un identifiant de connexion.
  Répercuté dans le miroir frontend.
- Le matricule est **diagnostiqué avant** d'atteindre Mongoose, avec un
  message qui dit quoi faire :
  - format invalide → rappel du format attendu, avec exemple ;
  - lettre incohérente → la lettre attendue et le matricule corrigé ;
  - déjà attribué → **le nom du membre qui le porte**, et la
    recommandation de rejeter la demande si c'est la même personne.
- Le champ **Matricule est devenu corrigeable** dans le panneau de
  validation (uniquement pour un membre historique — sur une inscription
  neuve il reste attribué automatiquement).

Dans le cas signalé, le diagnostic tombe juste : la demande émane de
**YAO Adou Emmanuel, déjà enregistré** sous `1OL 24-061 I`. Elle est donc
à rejeter, pas à valider.

---

## B. Service Social — caisses annuelles

### B1 — Une caisse par année, solde reporté ✅ TERMINÉ

**Décisions retenues (validées par le client) :**

1. Une caisse par **année civile**, gérant entrées et sorties.
2. Le solde est **reporté** sur la caisse suivante à la clôture.
3. Les arriérés remontent à **2024**.

**Ce qui a été fait.**

- Nouveau modèle `SocialFundYear` : un exercice par église × année, avec
  solde d'ouverture, statut (`ouvert`/`cloture`), solde de clôture figé.
- Nouveau service `socialFundYear.service.js`, **seul point d'écriture**
  d'un mouvement de caisse. Il rattache chaque mouvement à l'exercice
  courant et refuse d'écrire dans une caisse clôturée.
- `SocialLedgerEntry` porte désormais son exercice (`year`) + index.
- Clôturer un exercice fige son solde **et ouvre le suivant au solde
  reporté**, en une seule opération serveur : un solde ne peut pas se
  perdre entre deux appels.
- Réouverture possible (admin) : une clôture par erreur reste réparable.
- Garde-fou : `recordPayments` et `validateAid` vérifient l'exercice
  **avant** de modifier quoi que ce soit. Sans ça, une caisse clôturée
  laissait une offrande marquée « payée » sans contrepartie en caisse.
- Le solde initial n'est plus un réglage d'église (il en existait deux
  versions concurrentes) : il appartient au premier exercice.
- Écran Caisse refait : sélecteur d'exercice, report / entrées / sorties
  / solde séparés, et une fenêtre de gestion des exercices.

| Script | Effet | État |
|---|---|---|
| `migrateSocialFundYears.js --apply` | 4 mouvements rattachés à 2026 ; exercices 2024, 2025 (clôturés) et 2026 (ouvert) créés | ✅ appliqué |

---

### B2 — Arriérés cumulés depuis 2024 ✅ TERMINÉ

**Ce qui n'allait pas.** Le job ne générait **que le mois courant**. Un
membre validé aujourd'hui n'avait aucune ligne pour les mois écoulés :
aucun arriéré, donc rien à cumuler.

**Ce qui a été fait.**

- `generateDueContributions()` rattrape tous les mois dus depuis janvier
  2024, ou depuis le mois d'arrivée du membre s'il est postérieur (un
  membre de 2016 ne se voit pas réclamer dix ans).
- La fiche d'un membre expose son **solde cumulé** : total dû, total
  versé, reste à payer, et le trop-perçu à part.

---

### B3 — Écran « qui doit encore » ✅ TERMINÉ

L'API existait déjà (`GET /social/contributions/impayes`) mais **aucun
écran ne l'appelait**. Nouvel écran **Service Social → Arriérés** :
membres concernés, mois dus, période, déjà versé, reste dû, totaux, et
relance WhatsApp. Bouton « Générer les mois manquants » pour les admins.

---

### B4 — Liste sociale à jour automatiquement ✅ TERMINÉ

**Ce qui n'allait pas.** Valider un membre ne déclenchait rien côté
social : il fallait attendre le job quotidien (jusqu'à 24 h).

**Ce qui a été fait.** La validation d'une inscription **et** la
création/réactivation depuis l'administration génèrent immédiatement les
lignes du membre. En mode « au mieux » : une panne du module social
n'invalide jamais une inscription déjà approuvée, et le job quotidien
rattrape de toute façon.

---

### B5 — Totaux faux et liste tronquée sur les Offrandes ✅ TERMINÉ

**Ce qui n'allait pas.** L'écran demandait 300 lignes, l'API en plafonne
100. Passé 100 membres : liste tronquée sans message, filtre « en
retard » aveugle aux pages suivantes, et **barre de totaux fausse** (elle
additionnait les lignes chargées).

**Ce qui a été fait.** Pagination serveur, filtre « en retard » traduit
en condition Mongo, et totaux calculés par agrégation sur **tout le
mois** — justes quels que soient la page et le filtre.

---

## C. Qualité

| Contrôle | Résultat |
|---|---|
| Tests backend (`node --test`) | ✅ 308 / 308 |
| Tests frontend (`vitest run`) | ✅ 75 / 75 |
| ESLint | ✅ 0 avertissement |
| `npm run build` | ✅ |
| Fuite de CSS global | ✅ aucune (toutes les classes imbriquées sous leur racine) |

**Corrigé au passage :** un échec intermittent de la suite de tests.
`socialContribution.service.test.js` supprimait *tous* les membres de
l'église 5 en nettoyage, y compris les fixtures de `agent.service.test.js`
qui tourne en parallèle sur la même base. Le nettoyage ne vise plus que
ses propres fixtures.

**Note d'environnement :** si les tests de carte/badge échouent avec
« Cannot find native binding », c'est la dépendance optionnelle
`@napi-rs/canvas-linux-x64-gnu` qui manque localement (bug npm connu) —
`npm i` dans `backend/` la réinstalle. Sans rapport avec le code.

---

## D. Reste à faire

- [x] ~~**Vérifier l'affichage** de la carte et de la fiche PDF avec une
      vraie photo.~~ Fait le 25/08 : fiches régénérées et inspectées pour
      une source paysage (ratio 1,12) et une source portrait (0,75) — les
      proportions sont respectées, les visages entiers, aucun étirement.
      Cartes confirmées bonnes par le client.
- [ ] **Compression des images** (`src/assets/images/`, 2 à 2,7 Mo par
      fichier) — principal chantier de performance restant, identifié de
      longue date.
- [ ] **Mettre à jour `CLAUDE.md`** : il décrit encore un site vitrine
      « contenu en dur » et ignore les modules Membres, Présences, Âmes
      nouvelles et Social, qui font aujourd'hui l'essentiel du code.
