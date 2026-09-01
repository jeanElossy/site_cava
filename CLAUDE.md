# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Site vitrine du **Centre Apostolique Vie et Abondance (CAVA)**, une église. Contenu et libellés d'interface sont en **français**. Les explications à l'utilisateur se font en français ; le code (noms de variables, composants) reste en anglais.

## Commandes

Frontend (racine du dépôt) :

```bash
npm run dev       # serveur de dev Vite (HMR)
npm run build     # build de production vers dist/
npm run preview   # sert le build de production localement
npm run lint      # ESLint sur tout le projet
npm test          # Vitest — logique pure (utils, data.js des tunnels) et quelques rendus de composants clés
```

Backend ([backend/](backend/)) :

```bash
cd backend
npm run dev       # API Express en local, avec rechargement (--watch) — http://localhost:4000
npm run seed      # amorce la base : admin, contenu par défaut, moyens de paiement, types de don (idempotent)
npm test          # exécuteur de test intégré à Node (`node --test`), pas Jest ni Vitest
```

## Stack

React 19 + Vite 8, JavaScript/JSX uniquement (**ne jamais convertir en TypeScript sans autorisation explicite**), SCSS, React Router v7, Framer Motion pour les animations.

Note : `axios`, `react-hook-form`, `swiper` et `react-player` sont dans `package.json` mais **actuellement inutilisés** — le frontend appelle l'API backend via `fetch` natif (voir [src/services/http.js](src/services/http.js)), pas axios. Avant d'ajouter une dépendance, vérifier si le besoin est déjà couvert et demander validation.

Backend séparé : Node.js + Express 5 + MongoDB/Mongoose, dans [backend/](backend/) — voir la section **Backend** ci-dessous. Ce n'est plus un site 100 % statique.

## Architecture

Le **frontend** est une SPA React côté client ; l'état applicatif persistant (contenu géré depuis `/admin`, membres, dons…) vit dans le **backend** décrit plus bas, pas dans le frontend.

- [src/main.jsx](src/main.jsx) — monte l'app, importe `styles/main.scss`, enveloppe le tout dans `ContributionProvider`.
- [src/App.jsx](src/App.jsx) — `BrowserRouter` seul.
- [src/routes/AppRoutes.jsx](src/routes/AppRoutes.jsx) — **toutes** les routes publiques. Toute nouvelle page s'ajoute ici : `/`, `/about`, `/ministries`, `/ministries/:slug`, `/events`, `/events/:slug`, `/media`, `/communaute`, `/contact`, `/donate`, `/inscription`, `/mentions-legales`, `/politique-confidentialite`, `/desinscription`, `*` → NotFound.
- [src/routes/AdminRoutes.jsx](src/routes/AdminRoutes.jsx) — toutes les routes de `/admin`, chargées **paresseusement** : un visiteur du site public ne télécharge jamais ce morceau de bundle. Même mécanisme pour `/presences` (badgeage, réservé aux agents).

**Interrupteur de déploiement** : `/admin` et `/presences` n'existent que si `VITE_ENABLE_ADMIN=true` (ou en dev). Sur une build sans cette variable, la branche devient du code mort et Rollup supprime l'`import()` — le chunk n'est même pas généré. Ce n'est **pas** ce qui protège les données : c'est l'API qui refuse les requêtes non authentifiées.

**Pas de page Blog** : le client l'a explicitement refusée. Ne pas en créer, ne pas ajouter de lien "Blog" dans la Navbar ou le Footer, même si les maquettes de `src/assets/design/` en montrent un dans la barre de navigation.

### Pattern page → sections

Il n'y a **pas de layout partagé**. Chaque page dans `src/pages/<Nom>/<Nom>.jsx` importe et rend explicitement `<Navbar />` et `<Footer />`, puis compose une suite de composants « section » entre les deux. Voir [Home.jsx](src/pages/Home/Home.jsx) et [Donate.jsx](src/pages/Donate/Donate.jsx). Reproduire ce pattern pour toute nouvelle page — ne pas introduire de layout global sans validation.

### Organisation des composants

Deux conventions coexistent dans [src/components/](src/components/) :

1. **Dossier par composant** : `Hero/Hero.jsx` + `Hero/Hero.scss` — c'est la convention à suivre pour tout nouveau code.
2. **Fichiers plats** : `MinistriesGrid.jsx` + `MinistriesGrid.scss` à la racine de `components/` — legacy, utilisé par les pages About/Contact/Events/Ministries.
3. **Sous-dossier par feature** avec `index.jsx` : `components/donate/ContributionForm/index.jsx` — utilisé uniquement pour la page Donate et `MinistryDetails/`.

Le code mort a été supprimé (les anciens `Donation*` remplacés par `components/donate/*`, et `CallToServe`). `CalendarWidget` est désormais utilisé par la barre latérale de la page Événements.

### Données

**L'essentiel du contenu vit en base**, administrable depuis `/admin` : événements, médias, annonces, témoignages, moyens de paiement, types de don, types d'aide sociale, églises, bergeries, paramètres du site. Le frontend public le lit par `fetch` (voir [src/services/api.js](src/services/api.js)).

**Exception : les pages de ministères.** Leur contenu détaillé (mission, vision, stats, leaders, galerie, événements, témoignages) reste en dur dans [src/components/MinistryDetails/data/ministries.js](src/components/MinistryDetails/data/ministries.js), un objet indexé par `slug`. [MinistryDetails.jsx](src/pages/MinistryDetails/MinistryDetails.jsx) lit `useParams().slug` et affiche « Ministère introuvable » si la clé n'existe pas ; [MinistriesGrid.jsx](src/components/MinistriesGrid.jsx) dérive ses cartes du **même** fichier (la duplication qui existait entre les deux a été supprimée — ne pas la réintroduire).

Il existe par ailleurs une ressource `ministries` administrable en base, utilisée par l'administration ; elle ne pilote pas encore les pages publiques de détail.

### État global

Un seul contexte : [ContributionContext](src/context/ContributionContext.jsx), un `useReducer` (voir [contributionReducer.js](src/context/contributionReducer.js)) pour le tunnel de don en 4 étapes. L'état porte `amount`, `donationType: { id, name }`, `paymentMethod: { id, name, image, accountNumber, holderName }`, `donor: { firstName, lastName, phone, email }` et `proof: { transactionId, imageUrl }`. Les composants consomment via `useContribution()` et dispatchent `SET_AMOUNT`, `SET_DONATION_TYPE`, `SET_PAYMENT_METHOD`, `UPDATE_DONOR`, `SET_TRANSACTION_ID`, `SET_PROOF_IMAGE` et `RESET` (dispatché après un envoi réussi, pour ne pas laisser traîner la preuve du don précédent).

Types de don et moyens de paiement ne sont **plus écrits en dur** : ils viennent de l'API (`fetchDonationTypes` / `fetchPaymentMethods`, voir [src/services/donations.js](src/services/donations.js)) et sont administrables. Il n'y a plus de notion de « projet » — les types de don (« Construction », « Mission »…) jouent ce rôle.

**Préremplissage par l'URL** (c'est ce qui rend utile le QR code projeté pendant un culte, généré par `GET /api/admin/donations/qrcode`, qui encode `/donate?type=<nom>&amount=<montant>`) :

- `?type=` porte le **nom** du type de don, pas son identifiant Mongo. Il est lu par [StepIdentity.jsx](src/components/donate/ContributionForm/StepIdentity.jsx), qui le rapproche (casse et espaces ignorés) de la liste renvoyée par l'API dès qu'elle a répondu — le rapprochement ne peut pas se faire avant. Un choix déjà fait par le visiteur prime toujours.
- `?amount=` est lu par [Donate.jsx](src/pages/Donate/Donate.jsx), monté pendant toute la vie de la page (le placer dans une étape du tunnel, qui se démonte à chaque changement d'étape, réimposerait le montant de l'URL par-dessus celui que le visiteur vient de saisir).
- `ContributionTypes` et `ProjectsProgress` ne dispatchent rien : ce sont des **liens** vers `/donate?type=<nom>#contribution-form`, donc un seul mécanisme de préremplissage à maintenir.

## Backend

Un backend Node.js + Express 5 + MongoDB/Mongoose vit dans [backend/](backend/), déployé séparément sur **Render** (voir [backend/DEPLOIEMENT.md](backend/DEPLOIEMENT.md)). Le frontend l'appelle via `fetch` (voir [src/services/http.js](src/services/http.js)), à l'URL définie par `VITE_API_URL` (`.env` racine, ignoré par Git — **par défaut pointé sur l'API de production**, pas sur `localhost:4000` ; lire le commentaire du fichier avant de travailler sur `/admin` en local).

- [backend/src/server.js](backend/src/server.js) / [backend/src/app.js](backend/src/app.js) — démarrage et configuration Express (Helmet, CORS, rate limiting).
- [backend/src/routes/index.js](backend/src/routes/index.js) — **toutes** les routes API, montées directement sur les services : pas de couche `controllers` séparée. `resource.routes.js` fournit un CRUD générique (`createCrudService`) réutilisé par plusieurs ressources admin (médias, ministères, moyens de paiement, types de don…).
- `backend/src/models/` — schémas Mongoose. `backend/src/services/` — logique métier, indépendante d'Express.
- `backend/src/middlewares/`, `backend/src/jobs/`, `backend/src/config/`, `backend/src/utils/` — auth/rôles, tâches planifiées, configuration (`config/env.js` valide les variables au démarrage via `validateEnv()`), utilitaires.
- `backend/src/scripts/seed.js` — amorçage **idempotent** (admin, contenu par défaut, moyens de paiement, types de don) : ne supprime jamais rien, donc réutilisable sans risque sur une base déjà peuplée.

**Scripts de reprise de données** (`backend/src/scripts/`). Convention : ils **n'écrivent rien par défaut** et affichent leur plan ; il faut `--apply` pour exécuter. Tous sont idempotents.

| Script | Rôle |
|---|---|
| `backfillRegistrationOrder.js` | renseigne `Member.registrationOrder` sur les fiches antérieures au champ |
| `fixRegistrationControlLetters.js` | remet en cohérence une lettre de contrôle fautive |
| `migrateSocialFundYears.js` | rattache les mouvements de caisse à un exercice et ouvre les exercices manquants |
| `resetSocialStartYear.js` | supprime les cotisations et exercices antérieurs à 2026 restés sans le moindre encaissement |
| `backfillSocialContributions.js` | rattrape les lignes d'offrande dues, sans attendre le job quotidien |
| `reaffecterTropPercu.js` | replace le trop-perçu d'un mois sur les mois dus les plus anciens, sans toucher à la caisse |
| `seed-legacy-members.js` | import du registre papier |

**Pas de base de test dédiée** : [backend/src/test/db.js](backend/src/test/db.js) connecte les tests d'intégration à la **même** base que le développement (`MONGODB_URI`), y compris en local. Les tests doivent donc nettoyer scrupuleusement ce qu'ils créent (identifiants improbables en production, ex. e-mails `*.testsuite.*@example.invalid`). Ne jamais interrompre `cd backend && npm test` en cours de route (Ctrl+C ou kill du process) : les hooks `after()` de nettoyage n'ont alors pas l'occasion de s'exécuter et laissent des données de test résiduelles dans la base partagée — vécu concrètement lors de la vérification finale de la fonctionnalité de dons (Task 24), où un processus de test interrompu a laissé une bergerie de test fantôme qui a fait échouer la suite `newSoul.service` d'une session ultérieure avec une erreur de clé dupliquée, le temps d'être identifiée et nettoyée à la main.

### Modules d'administration

Le projet n'est plus un simple site vitrine : `/admin` porte plusieurs modules métier, chacun avec ses modèles, son service et ses écrans.

- **Communauté** (`/admin/communaute`) — annuaire des membres, bergeries, églises, et validation des inscriptions envoyées depuis `/inscription`. Génère cartes de membre (PDF/JPEG), fiches individuelles (PDF) et exports (XLSX/PDF).
- **Présences** (`/admin/presences`, badgeage sur `/presences`) — pointage par scan du QR de la carte de membre, réservé aux agents du Service d'Ordre.
- **Nouvelles âmes** (`/admin/nouvelles-ames`) — suivi des nouveaux convertis, du premier contact à la clôture (qui crée le membre). Circuit à plusieurs rôles : SOA, CANA, coordonnateur de bergeries.
- **Dons** (`/admin/dons`) — voir ci-dessous.
- **Service Social** (`/admin/social`) — voir plus bas.
- **Agents** (`/admin/agents`) — comptes de terrain, qui se connectent par **matricule** et non par e-mail.

### Matricule des membres

Format canonique stocké, 9 caractères sans séparateur : `1ME19016P`, affiché `1ME 19-016 P`.

| `1` | `ME` | `19` | `016` | `P` |
|---|---|---|---|---|
| église (1-5) | code de bergerie | année d'arrivée | rang dans l'église | lettre de contrôle |

- Le **rang** est attribué par un compteur atomique **par église** (`RegistrationCounter`) — deux validations simultanées ne peuvent pas obtenir le même numéro.
- La **lettre ne se saisit jamais** : elle se déduit du rang (`alphabet[(rang - 1) % 26]`, donc 016 → P, et elle repart à A après Z). C'est un repère de recopie, pas une sécurité. Le modèle **refuse** un matricule dont la lettre contredit le rang.
- Les listes du Service Social (offrandes, arriérés) suivent **le même ordre que l'annuaire**, et pour la même raison : le tri se fait dans l'agrégation Mongo (`memberSortStages` dans [socialContribution.service.js](backend/src/services/socialContribution.service.js)), jamais dans le navigateur. Le matricule vivant sur le membre et non sur la ligne d'offrande, cela impose une jointure — c'est le prix d'un ordre qui reste continu d'une page à l'autre.
- `Member.registrationOrder` est le rang **dérivé et dénormalisé**, recalculé à chaque écriture par des hooks du schéma. C'est lui qui donne l'ordre de l'annuaire (`defaultSort: { church, registrationOrder, lastName }`). **Ne jamais retrier côté navigateur** : la liste est paginée, retrier une page ne réordonne qu'elle et fait « sauter » les matricules.
- Les fonctions pures du format vivent dans [backend/src/utils/registrationFormat.js](backend/src/utils/registrationFormat.js), avec un **miroir** frontend dans [src/utils/registrationNumber.js](src/utils/registrationNumber.js) — le dépôt n'a pas de code partagé entre le site et l'API, toute évolution du format se répercute des deux côtés.
- `normalizeRegistrationNumber` répare les confusions `O`/`0` et `I`/`1` **par position** (le format impose la nature de chaque caractère, la correction est donc déterministe) et ignore espaces et tirets de la forme affichée.

### Dons — parcours Mobile Money manuel

Le paiement en ligne a été remplacé par un parcours **Mobile Money déclaratif**, sans intégration de paiement tierce (l'ancienne intégration CinetPay a été retirée) :

1. **Public**, page `/donate` (composant [src/components/donate/ContributionForm/](src/components/donate/ContributionForm/)) : tunnel à 4 étapes — identité/montant/type (`StepIdentity`) → moyen de paiement (`StepPaymentMethod`) → billet QR à scanner (`StepQrTicket`) → preuve (numéro de transaction Mobile Money obligatoire, capture d'écran optionnelle — `StepProof`). Le don n'est créé en base qu'à l'étape finale (« Envoyer »), avec le statut `en_attente`.
2. **Admin** : `/admin/dons` (`DonationsAdmin.jsx`) liste les dons et permet de les **valider** ou **rejeter** — le rejet est bloqué côté serveur sans remarque ; `/admin/dons/moyens-de-paiement` gère les QR Mobile Money proposés dans le tunnel (Orange Money, MTN, Moov, Wave…) ; `/admin/dons/types` gère les types de don (Dîme, Offrande, Action de grâce…). Un moyen de paiement sans QR/numéro renseigné ne doit jamais être activé (`active: true`) : le tunnel l'affiche alors aux donateurs tel quel.
3. Un don validé expose un reçu PDF public, non authentifié, à `GET /api/donations/:reference/recu` (lien « Reçu » dans `DonationsAdmin`). Aucune vérification n'est automatique : la mise en correspondance du numéro de transaction avec le relevé Mobile Money réel de l'église reste un geste manuel de l'administrateur.

### Service Social — offrandes, arriérés et caisses annuelles

Module de solidarité : chaque membre actif doit une **offrande sociale mensuelle**, et la caisse ainsi constituée finance des **aides** versées aux membres.

**Une caisse par église ET par année civile** (`SocialFundYear`). Points de conception à ne pas contourner :

- **Un mouvement appartient à l'exercice de sa DATE D'ENREGISTREMENT**, pas au mois cotisé. C'est une comptabilité de caisse : l'argent entre dans le tiroir le jour où l'agent l'encaisse. Un arriéré de 2025 réglé en 2027 alimente donc la caisse 2027 — la dette, elle, reste datée de 2025 côté `SocialContribution`, qui porte `year`/`month`.
- Conséquence utile : un exercice révolu ne peut plus recevoir d'écriture (l'horloge serveur ne recule pas), donc son solde de clôture est définitif. C'est ce qui autorise à **stocker** le report sans risque de divergence.
- **Le solde est reporté** sur l'exercice suivant à la clôture. Clôturer fige le solde **et** ouvre l'année suivante, en une seule opération serveur : un solde ne peut pas se perdre entre deux appels. Une réouverture reste possible (admin) pour réparer une clôture par erreur.
- [socialFundYear.service.js](backend/src/services/socialFundYear.service.js) est le **seul point d'écriture** d'un mouvement de caisse (`recordLedgerEntry`). Ne jamais faire `SocialLedgerEntry.create()` en direct : on perdrait le rattachement à l'exercice et le refus d'écrire dans une caisse clôturée.
- `recordPayments` et `validateAid` **contrôlent l'exercice avant toute mutation** (`assertExerciceOpen`). Découvrir la clôture au moment de journaliser laisserait une offrande « payée » sans contrepartie en caisse.

**Point de départ : janvier 2026.** `SOCIAL_START_YEAR` vaut **2026** — c'est à la fois le premier exercice de caisse et la première année réclamée automatiquement. Le module avait d'abord été cadré sur 2024 ; la génération avait alors ouvert 2024 et 2025 à tous les membres, soit une dette réclamée à des gens qui avaient déjà réglé sur le registre papier. `resetSocialStartYear.js` efface ces lignes (uniquement celles restées sans le moindre encaissement, il s'arrête en le signalant sur toute ligne qui porte de l'argent).

Conséquence à ne pas perdre de vue : **2026 est le premier exercice ET l'exercice courant**. Il n'existe aucun exercice passé, donc aucun endroit où vérifier l'isolation entre exercices « vers le bas » — les tests de `socialFundYear.service.test.js` la vérifient sur l'exercice *suivant*.

**Arriérés antérieurs : saisis à la main, membre par membre.** `SOCIAL_LEGACY_START_YEAR` vaut **2025**. Ces mois-là ne sont jamais générés : le responsable ouvre les seuls mois réellement restés impayés, depuis la fiche sociale du membre (`/admin/social/membres`), via `recordLegacyArrears()` — `POST /api/admin/social/members/:memberId/arrieres`, réservé à `admin`/`social_admin` parce que c'est une **création de dette**, pas un encaissement. Idempotent, et un mois déjà ouvert garde son montant d'origine.

La dette reste datée de 2025, mais son règlement alimente la caisse de l'année où il est encaissé — la règle de caisse déjà en vigueur, rien de particulier à prévoir : le paiement passe par `recordPayments` comme n'importe quel autre mois. Côté lecture, les impayés se filtrent sur une **année de cotisation** (`parseContributionYear`, bornée à 2025), pas sur une année d'exercice (bornée à 2026) — confondre les deux masquerait précisément ces arriérés.

**Arriérés courants.** `generateDueContributions()` rattrape tous les mois dus depuis `SOCIAL_START_YEAR`, ou depuis le mois d'arrivée du membre s'il est postérieur. La fonction est idempotente (index unique `{member, year, month}`).

⚠️ **Appelée SANS le paramètre `church`, elle balaie toutes les églises dotées d'un `SocialFundSettings`, production comprise.** Un test d'intégration qui l'oublie régénère les offrandes réelles — bug déjà constaté. Toute suite de tests doit passer son église de test.

Elle est déclenchée par le job quotidien, **et** immédiatement à la validation d'une inscription comme à la création/réactivation d'un membre (`syncMemberContributionsQuietly`, en « au mieux » : une panne du module social ne doit pas invalider une inscription approuvée).

**Le montant mensuel est un plancher, pas un plafond** : un membre peut donner plus pour un même mois. Seul un versement sous ce plancher laisse le mois `partiel`.

## Styles

- Point d'entrée : [src/styles/main.scss](src/styles/main.scss) → `@use` de `_variables`, `_mixins`, `_reset`. Importé une seule fois dans `main.jsx`.
- Les couleurs sont dans [_variables.scss](src/styles/_variables.scss). Attention : deux jeux de noms coexistent pour les mêmes couleurs (`$primary` / `$primary-green`, `$secondary` / `$primary-yellow` — cette dernière paire diffère légèrement : `#ffd22e` vs `#f4c41d`). Préférer `$primary` / `$secondary`.
- Mixins disponibles : `flex-center`, `container` (max-width 1400px).
- Les SCSS de composants qui ont besoin des variables font `@use "../../styles/variables" as *;` (chemin relatif selon la profondeur). Environ la moitié des fichiers n'importent rien et codent les couleurs en dur — ne pas suivre cet exemple.
- Nommage **BEM** avec l'imbrication SCSS : `.hero`, `&__overlay`, `&--active`.

### Piège majeur : il n'y a pas de CSS modules

Tous les SCSS de composants sont compilés dans **une feuille de style unique**. Toute classe déclarée à la racine d'un fichier est donc **globale** et s'applique à tout le site, y compris dans les media queries.

Ce bug s'est produit quatre fois, à chaque fois en cassant silencieusement une *autre* page :
- `.icon` / `.card` / `.line` (Values, accueil) → déformait les icônes de la section Ministères
- `.event-description` (page détail d'événement) → injectait `padding: 80px 0 40px` dans chaque ligne d'événement de l'accueil
- `.value-card h3 { min-height: 52px }` (page À propos) → ajoutait de la hauteur aux cartes de l'accueil
- `.event-date span { color: #555 }` (page Événements) → grisait les dates sur l'accueil

**Règle** : dans tout SCSS de composant, imbriquer l'intégralité des styles sous la classe racine du composant. Ne jamais déclarer à la racine d'un fichier un nom générique (`.card`, `.icon`, `.line`, `.overlay`, `.badge`, `.section-header`, `.form-group`, `.checkbox`…). Chaque classe générique ne doit avoir qu'un seul propriétaire global dans tout le projet.

Vérification après modification d'un SCSS :
```bash
npm run build
grep -o "[^{},]*\.<classe>[^{},]*{" dist/assets/*.css
```

Attention aussi aux composants rendus à plusieurs endroits : `ImpactSection` apparaît à la fois dans `ContributionForm` et en section autonome de la page Don — cloisonner son SCSS sous `.contribution-form` casse la seconde instance.
- Police : Poppins, chargée via Google Fonts dans [index.html](index.html).

## SEO

Le hook [src/hooks/usePageMeta.js](src/hooks/usePageMeta.js) renseigne `<title>` et la meta description par page. L'appeler dans toute nouvelle page — `index.html` ne porte qu'un titre générique valable pour tout le site.

## Assets

Deux emplacements distincts, ne pas les confondre :
- `src/assets/` — importé depuis le JS/SCSS, traité par Vite (hashé au build).
- `public/images/` — référencé par chemin absolu (`/images/media/...`), copié tel quel. Ces chemins ne sont **pas vérifiés au build** : une faute de frappe passe le `npm run build` et casse silencieusement en production.

`src/assets/design/` contient des maquettes de référence, pas des assets de production. Attention, `Event details.png` est mal nommé : c'est la maquette du **détail de ministère**, pas d'un détail d'événement.

**Poids des images** (mesuré le 25/08/2026 — une note plus ancienne annonçait « 2 à 2,7 Mo par fichier », c'était faux) : la plus grosse image embarquée pèse **291 Ko**, pour **5,7 Mo** au total. Une recompression JPEG/PNG ne rendrait que 4 % : elles sont déjà correctes. Un passage en **WebP** rendrait 42 % (2,4 Mo), mais suppose de réécrire chaque référence — à peser contre le fait que les chemins de `public/images/` ne sont pas vérifiés au build.

⚠️ Tout ce qui traîne dans `public/` est **copié tel quel à chaque déploiement**, référencé ou non. Un fichier de 1,5 Mo y est resté des semaines sans être utilisé nulle part. Vérifier avant d'y déposer un fichier.

`src/assets/images/` contient à l'inverse ~3,5 Mo d'images **importées nulle part** : Vite ne les embarque pas, donc aucun impact en production — mais ne pas s'y fier pour juger du poids réel du site.

## Déploiement

Deux déploiements distincts :

- **Frontend** sur Vercel. [vercel.json](vercel.json) fait un rewrite SPA de toutes les routes vers `index.html` et impose des en-têtes de sécurité, dont une **CSP stricte**. `connect-src` n'autorise que `'self'`, l'API de production (`https://site-cava.onrender.com`) et Cloudinary (`https://api.cloudinary.com`) ; `img-src`/`media-src` autorisent Cloudinary et `i.ytimg.com`. Toute nouvelle intégration tierce (autre domaine d'API, iframe, script analytics) sera bloquée tant que `vercel.json` n'est pas mis à jour en conséquence.
- **Backend** sur Render, connecté à MongoDB Atlas — voir [backend/DEPLOIEMENT.md](backend/DEPLOIEMENT.md) pour la procédure et ses compromis (notamment l'absence d'IP fixe côté Render, qui oblige à autoriser `0.0.0.0/0` dans Atlas Network Access).

## Tests

- **Frontend** : `npm test` (Vitest) — logique pure et quelques rendus de composants clés.
- **Backend** : `cd backend && npm test` (`node --test`, ni Jest ni Vitest).

Les tests d'intégration tournent sur la **base de développement**, et `node --test` exécute les fichiers **en parallèle**. Deux règles en découlent :

1. **Ne jamais nettoyer par un critère large** (`deleteMany({ church })`) : un autre fichier de test peut utiliser la même église au même instant et voir ses fixtures disparaître en pleine assertion. Nettoyer sur un marqueur propre à la suite (préfixe de nom, e-mail `*.testsuite.*@example.invalid`).
2. **Ne jamais interrompre une exécution** (Ctrl+C) : les hooks `after()` ne s'exécutent pas et laissent des résidus dans la base partagée. Vécu deux fois — une bergerie fantôme puis un membre fantôme visible dans l'annuaire réel.

Les églises 2 à 5 servent de bacs à sable (l'église 1 est la seule réelle). L'église fictive « 9 » évoquée dans certains commentaires est **inutilisable dès qu'un `Member` est en jeu** : le schéma valide `church` entre 1 et 5.

Comme il n'y a que quatre bacs à sable pour une vingtaine de fichiers, ils sont **partagés** — d'où la règle de nettoyage ci-dessus. Une ressource **unique par église** ne se partage en revanche pas du tout : `SocialFundSettings` porte un index unique sur `church`, donc deux fichiers qui en créent un pour la même église s'excluent (clé dupliquée, ou réglages effacés selon l'ordre). Répartition actuelle des fichiers qui créent un `SocialFundSettings` : **3** `socialFundYear`, **4** `socialAid`, **5** `socialContribution`, **2** `social.routes`. Un nouveau fichier de ce type a besoin de sa propre église, ou d'aucune.

Symptôme typique d'un nettoyage trop large : un test qui échoue sur une donnée qu'il vient lui-même de créer (« Aucun membre trouvé avec ce matricule » juste après un `Member.create`). Le fichier fautif n'est pas celui qui échoue — c'est celui qui a supprimé, en parallèle, par un critère qui ne lui appartenait pas.

## Conventions du dépôt

Le dossier `.claude/` contient des agents, skills et docs de standards partagés entre projets ; ils décrivent une stack backend Node/Express/MongoDB — qui, depuis l'ajout du backend documenté ci-dessus, correspond bien à ce dépôt (auparavant ce n'était pas le cas, et cette note l'excluait explicitement : si un document plus ancien du projet affirme encore l'inverse, il est obsolète). `.claude/memory/` (decisions, known-issues, roadmap) est prévu pour consigner les décisions importantes au fil du projet.
