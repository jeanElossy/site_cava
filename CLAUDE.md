# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Site vitrine du **Centre Apostolique Vie et Abondance (CAVA)**, une église. Contenu et libellés d'interface sont en **français**. Les explications à l'utilisateur se font en français ; le code (noms de variables, composants) reste en anglais.

## Commandes

```bash
npm run dev       # serveur de dev Vite (HMR)
npm run build     # build de production vers dist/
npm run preview   # sert le build de production localement
npm run lint      # ESLint sur tout le projet
```

Aucune infrastructure de test n'est configurée. Ne pas inventer de commande `npm test`.

## Stack

React 19 + Vite 8, JavaScript/JSX uniquement (**ne jamais convertir en TypeScript sans autorisation explicite**), SCSS, React Router v7, Framer Motion pour les animations.

Note : `axios`, `react-hook-form`, `swiper` et `react-player` sont dans `package.json` mais **actuellement inutilisés** — le site est entièrement statique, sans backend ni appel API. Avant d'ajouter une dépendance, vérifier si le besoin est déjà couvert et demander validation.

## Architecture

Application 100 % côté client, sans état serveur.

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

Un seul contexte : [ContributionContext](src/context/ContributionContext.jsx), un `useReducer` pour le formulaire de don (type, montant, projet, moyen de paiement Orange/MTN/Moov/Wave, coordonnées du donateur). Les composants consomment via `useContribution()` et dispatchent des actions typées (`SET_TYPE`, `SET_AMOUNT`, …). La page Donate lit `?type=` dans l'URL pour préremplir le type de contribution.

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

Vercel. [vercel.json](vercel.json) fait un rewrite SPA de toutes les routes vers `index.html` et impose des en-têtes de sécurité, dont une **CSP stricte** : `script-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`. Conséquence : toute intégration tierce (iframe YouTube, carte externe, appel API vers un autre domaine, script analytics) sera bloquée tant que la CSP n'est pas mise à jour en conséquence.

## Conventions du dépôt

Le dossier `.claude/` contient des agents, skills et docs de standards partagés entre projets ; ils décrivent aussi une stack backend Node/Express/MongoDB qui **n'existe pas dans ce dépôt** — ignorer ces parties ici. `.claude/memory/` (decisions, known-issues, roadmap) est prévu pour consigner les décisions importantes au fil du projet.
