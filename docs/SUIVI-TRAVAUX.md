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

### B2 — Arriérés cumulés ✅ TERMINÉ

> ⚠️ **Recadré le 25/08 : le point de départ est passé de 2024 à
> janvier 2026.** Voir B6 ci-dessous — ce qui suit décrit le mécanisme
> de rattrapage, dont la borne basse a changé.


**Ce qui n'allait pas.** Le job ne générait **que le mois courant**. Un
membre validé aujourd'hui n'avait aucune ligne pour les mois écoulés :
aucun arriéré, donc rien à cumuler.

**Ce qui a été fait.**

- `generateDueContributions()` rattrape tous les mois dus depuis
  `SOCIAL_START_YEAR`, ou depuis le mois d'arrivée du membre s'il est
  postérieur (un membre de 2016 ne se voit pas réclamer dix ans).
- La fiche d'un membre expose son **solde cumulé** : total dû, total
  versé, reste à payer, et le trop-perçu à part.

---

### B6 — Départ au 1ᵉʳ janvier 2026, arriérés 2025 saisis à la main ✅ TERMINÉ (⚠️ une commande à lancer)

**Ce qui n'allait pas.** Le module avait été cadré sur 2024. La
génération avait donc ouvert **1 044 mois dus** (492 pour 2024, 552 pour
2025) à tous les membres — une dette réclamée à des gens qui, pour
beaucoup, avaient déjà réglé sur le registre papier de l'époque. Aucune
de ces lignes n'avait jamais reçu le moindre franc.

**Ce qui a été fait.**

- `SOCIAL_START_YEAR` passe de 2024 à **2026** : premier exercice de
  caisse, et première année réclamée automatiquement.
- Nouvelle borne `SOCIAL_LEGACY_START_YEAR = 2025` : l'année pour
  laquelle un arriéré peut être **saisi à la main**, jamais généré.
- **Nouvel encadré sur la fiche sociale d'un membre**
  (`/admin/social/membres`) : le responsable choisit l'année, coche les
  seuls mois restés impayés, et fixe au besoin un montant mensuel
  différent de celui d'aujourd'hui (le tarif de l'époque n'est pas
  conservé en base). Les mois déjà ouverts apparaissent cochés et
  verrouillés. Réservé à `admin` / `social_admin` : ouvrir un arriéré,
  c'est **créer une dette**, pas encaisser — l'agent de terrain n'a pas
  à en décider.
- Réglés aujourd'hui, ces arriérés alimentent la **caisse 2026**, en
  passant par le circuit de paiement habituel. C'est la règle de caisse
  déjà en vigueur : l'argent entre dans le tiroir le jour où il est
  encaissé, la dette garde sa date.
- L'écran **Arriérés** filtre désormais sur une *année de cotisation*
  (2025 comprise) et non plus sur une *année d'exercice* (2026 au plus
  tôt) — sans quoi le seul arriéré qu'on ait pris la peine de saisir
  serait resté invisible.
- Un paiement ne peut plus fabriquer une ligne pour une année hors
  périmètre : une faute de frappe d'année créait auparavant une dette
  fantôme pour 2019.

**⚠️ Il reste UNE commande à lancer.** Le nettoyage de la base n'a pas
pu être exécuté depuis cette session (l'environnement bloque les
suppressions en base). Tant qu'elle n'est pas passée, **l'écran Arriérés
continue d'afficher 2024 et 2025** :

```bash
cd backend
node src/scripts/resetSocialStartYear.js           # simulation, n'écrit rien
node src/scripts/resetSocialStartYear.js --apply   # exécute
```

Le script ne supprime que ce qui n'a **jamais rien encaissé** (statut
`non_paye`, 0 versé, aucune référence de reçu) et s'arrête en le
signalant sur toute ligne qui porte de l'argent. Simulation déjà passée :
1 044 cotisations et 2 exercices vides à supprimer, **aucune ligne
porteuse d'argent**.

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

## C bis. Site public — bannières (heros)

### C1 — Toutes les pages à la même hauteur de bannière ✅ TERMINÉ

**Demande.** Que chaque page publique ait la même bannière que l'accueil.

**Ce qui n'allait pas.** Chaque hero portait sa propre hauteur, écrite en
dur : 620, 640, 650, 700, 720 px selon la page, et parfois `auto` sous
768 px. Aucune page n'avait la bannière de l'accueil (`100vh`).

**Ce qui a été fait.** Un mixin unique `hero-height` dans
[_mixins.scss](src/styles/_mixins.scss), appelé par les **12 heros**. Les
`min-height` des media queries de chaque fichier ont été supprimées :
elles redivergeraient. Barème unique :

| Écran | Hauteur |
|---|---|
| > 992 px | `100vh` (référence : l'accueil) |
| ≤ 992 px | `80vh` |
| ≤ 768 px | `70vh` |

La réduction sous 992 px est volontaire : à `100vh`, la bannière occupait
tout l'écran et repoussait le contenu réel sous la ligne de flottaison —
et sur mobile `100vh` dépasse la zone visible, la barre d'adresse
n'étant pas comptée. Vérifié par capture d'écran en 1600×900, 820×1180
et 390×844.

### C2 — Page Don : l'image ne remplissait pas la bannière ✅ TERMINÉ

L'image de fond était placée **dans** `.contribution-hero__container`,
centré et plafonné à 1400 px. Une image en `position: absolute` se cale
sur son ancêtre positionné : elle s'arrêtait donc à 1400 px et
n'atteignait pas les bords au-delà. Sortie du conteneur, elle devient un
calque de fond du hero (comme l'overlay), avec un `z-index` explicite.

### C3 — Page À propos : titre trop grand ✅ TERMINÉ

Le titre fait **trois lignes longues** là où celui de l'accueil en fait
deux courtes. À taille quasi égale (3,8 rem contre 4 rem), son bloc
occupait la moitié de la bannière. Ramené à `clamp(1.8rem, 2.9vw,
2.9rem)`, et les trois paliers responsives réduits d'autant.

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

**Corrigé au passage (2) :** `listUnpaid()` peuplait `member.flock`
sans importer le modèle `Flock`. Ça ne fonctionnait que par effet de
bord — `routes/index.js` charge ce modèle ailleurs — et la fonction
échouait dès qu'on l'appelait hors du serveur complet (script, test
isolé). La dépendance est maintenant explicite.

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
- [x] ~~**Compression des images**~~ — **la prémisse était fausse.** La
      note « 2 à 2,7 Mo par fichier », héritée d'un `CLAUDE.md` obsolète,
      ne correspond à rien : mesuré le 25/08, la plus grosse image
      embarquée pèse **291 Ko**, et une recompression JPEG/PNG de tout le
      lot ne rendrait que **4 %**. Les images sont déjà correctes.

      Ce qui a réellement été fait : suppression d'un fichier parasite de
      **1,5 Mo** (`ChatGPT Image 3 août 2026…png`) qui traînait dans
      `public/` — donc copié tel quel à chaque déploiement — et n'était
      référencé nulle part, ni dans le code ni en base. Le poids
      embarqué passe de 7,2 à 5,7 Mo.

- [ ] **(optionnel) Passer les images en WebP** — mesuré : 5,69 Mo →
      3,27 Mo, soit **42 % (2,4 Mo)**. Non fait : il faudrait réécrire
      chaque référence, et les chemins de `public/images/` ne sont pas
      vérifiés au build (une faute de frappe casse en silence). À
      décider — je peux le faire proprement si vous le voulez.

- [ ] **(optionnel) Nettoyer `src/assets/images/`** — 3,49 Mo d'images
      qui ne sont importées nulle part (dont `mariage.png`, 1,65 Mo, et
      les logos Mobile Money, remplacés par les moyens de paiement gérés
      en base). Vite ne les embarque pas, donc **aucun impact en
      production** : c'est du poids de dépôt, pas de performance. À
      supprimer seulement si vous confirmez qu'elles ne servent plus.
- [x] ~~**Mettre à jour `CLAUDE.md`**~~ — fait le 25/08. Corrigé : la
      liste des routes (incomplète), « le contenu est en dur » (faux,
      l'essentiel vit en base), une « duplication connue » des
      ministères qui n'existe plus, et le poids des images. Ajouté : les
      modules d'administration, le **format du matricule** et la règle
      de la lettre de contrôle, le **Service Social** (règle de
      rattachement d'un mouvement à un exercice, report du solde, point
      d'écriture unique, garde-fous), les scripts de reprise, et une
      section **Tests** rappelant les deux pièges de la base partagée.
