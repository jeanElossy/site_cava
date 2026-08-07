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
- [src/routes/AppRoutes.jsx](src/routes/AppRoutes.jsx) — **toutes** les routes. Toute nouvelle page s'ajoute ici. Routes : `/`, `/about`, `/ministries`, `/ministries/:slug`, `/events`, `/media`, `/contact`, `/donate`, `/mentions-legales`, `/politique-confidentialite`, `*` → NotFound.

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

Le contenu est en dur dans le code. Les données des ministères vivent dans [src/components/MinistryDetails/data/ministries.js](src/components/MinistryDetails/data/ministries.js) : un objet indexé par `slug`, chaque ministère portant son propre contenu (mission, vision, stats, leaders, galerie, événements, témoignages). `MinistryDetails.jsx` lit `useParams().slug` et affiche un fallback « Ministère introuvable » si la clé n'existe pas.

**Duplication connue** : la liste des ministères existe en double, dans ce fichier et dans [src/components/MinistriesGrid.jsx](src/components/MinistriesGrid.jsx). Les slugs concordent aujourd'hui — toute modification doit être répercutée des deux côtés, sinon une carte mène à « Ministère introuvable ».

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

**Pas de base de test dédiée** : [backend/src/test/db.js](backend/src/test/db.js) connecte les tests d'intégration à la **même** base que le développement (`MONGODB_URI`), y compris en local. Les tests doivent donc nettoyer scrupuleusement ce qu'ils créent (identifiants improbables en production, ex. e-mails `*.testsuite.*@example.invalid`). Ne jamais interrompre `cd backend && npm test` en cours de route (Ctrl+C ou kill du process) : les hooks `after()` de nettoyage n'ont alors pas l'occasion de s'exécuter et laissent des données de test résiduelles dans la base partagée — vécu concrètement lors de la vérification finale de la fonctionnalité de dons (Task 24), où un processus de test interrompu a laissé une bergerie de test fantôme qui a fait échouer la suite `newSoul.service` d'une session ultérieure avec une erreur de clé dupliquée, le temps d'être identifiée et nettoyée à la main.

### Dons — parcours Mobile Money manuel

Le paiement en ligne a été remplacé par un parcours **Mobile Money déclaratif**, sans intégration de paiement tierce (l'ancienne intégration CinetPay a été retirée) :

1. **Public**, page `/donate` (composant [src/components/donate/ContributionForm/](src/components/donate/ContributionForm/)) : tunnel à 4 étapes — identité/montant/type (`StepIdentity`) → moyen de paiement (`StepPaymentMethod`) → billet QR à scanner (`StepQrTicket`) → preuve (numéro de transaction Mobile Money obligatoire, capture d'écran optionnelle — `StepProof`). Le don n'est créé en base qu'à l'étape finale (« Envoyer »), avec le statut `en_attente`.
2. **Admin** : `/admin/dons` (`DonationsAdmin.jsx`) liste les dons et permet de les **valider** ou **rejeter** — le rejet est bloqué côté serveur sans remarque ; `/admin/dons/moyens-de-paiement` gère les QR Mobile Money proposés dans le tunnel (Orange Money, MTN, Moov, Wave…) ; `/admin/dons/types` gère les types de don (Dîme, Offrande, Action de grâce…). Un moyen de paiement sans QR/numéro renseigné ne doit jamais être activé (`active: true`) : le tunnel l'affiche alors aux donateurs tel quel.
3. Un don validé expose un reçu PDF public, non authentifié, à `GET /api/donations/:reference/recu` (lien « Reçu » dans `DonationsAdmin`). Aucune vérification n'est automatique : la mise en correspondance du numéro de transaction avec le relevé Mobile Money réel de l'église reste un geste manuel de l'administrateur.

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

**Images non optimisées** : les fichiers de `src/assets/images/` pèsent 2 à 2,7 Mo pièce. Une galerie de ministère en charge 6 d'un coup. Une passe de compression/WebP est le principal chantier de performance restant.

## Déploiement

Deux déploiements distincts :

- **Frontend** sur Vercel. [vercel.json](vercel.json) fait un rewrite SPA de toutes les routes vers `index.html` et impose des en-têtes de sécurité, dont une **CSP stricte**. `connect-src` n'autorise que `'self'`, l'API de production (`https://site-cava.onrender.com`) et Cloudinary (`https://api.cloudinary.com`) ; `img-src`/`media-src` autorisent Cloudinary et `i.ytimg.com`. Toute nouvelle intégration tierce (autre domaine d'API, iframe, script analytics) sera bloquée tant que `vercel.json` n'est pas mis à jour en conséquence.
- **Backend** sur Render, connecté à MongoDB Atlas — voir [backend/DEPLOIEMENT.md](backend/DEPLOIEMENT.md) pour la procédure et ses compromis (notamment l'absence d'IP fixe côté Render, qui oblige à autoriser `0.0.0.0/0` dans Atlas Network Access).

## Conventions du dépôt

Le dossier `.claude/` contient des agents, skills et docs de standards partagés entre projets ; ils décrivent une stack backend Node/Express/MongoDB — qui, depuis l'ajout du backend documenté ci-dessus, correspond bien à ce dépôt (auparavant ce n'était pas le cas, et cette note l'excluait explicitement : si un document plus ancien du projet affirme encore l'inverse, il est obsolète). `.claude/memory/` (decisions, known-issues, roadmap) est prévu pour consigner les décisions importantes au fil du projet.
