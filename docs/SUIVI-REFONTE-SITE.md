# Suivi — Refonte visuelle du site public

Ouvert le 13 octobre 2026. Demande : refaire les pages publiques dans un
style « pro et moderne », corriger les défauts rencontrés, sécuriser.

Règle de ce fichier : une case n'est cochée que si la page a été **ouverte
et vérifiée** (capture ordinateur 1440 px + mobile 390 px, sans
débordement horizontal), pas seulement écrite.

## Langage visuel retenu (page Communauté, référence pour les suivantes)

- Sur-titre en capitales espacées, jaune foncé (`$secondary-dark`) sur
  fond clair, jaune (`$secondary`) sur fond vert, précédé d'un filet.
- Titres de section `clamp(1.9rem, 3.2vw, 2.7rem)`, vert foncé,
  interlettrage légèrement resserré.
- Alternance des fonds : blanc / crème `#f7f5ee` / vert foncé.
- Cartes : rayon 22 px, bordure très légère, ombre verte diffuse.
- Boutons en pilule : jaune plein (action principale), contour blanc
  (action secondaire sur fond vert).

## Pages

- [x] **Communauté** (`/communaute`) — 13/10/2026. Vérifiée en capture
      ordinateur et mobile, annonce dépliée comprise.
  - Hero : titre éditorial, deux appels à l'action (« Devenir membre » →
    `/inscription`, « Trouver un groupe de maison » → ancre `#groupes`),
    verset en carte.
  - Chiffres : bandeau blanc qui chevauche le hero ; colonnes
    automatiques (la grille figée à 4 colonnes laissait un trou quand un
    chiffre sous son seuil est masqué — cas réel : « Serviteurs » = 4).
  - Annonces : **défaut corrigé** — le texte saisi s'affichait brut
    (`##`, `*` visibles, sans retours à la ligne) dans une carte étroite.
    Aperçu tronqué + « Lire l'annonce complète » ; mise en forme par
    `src/utils/richText.js` (8 tests), **sans HTML injecté**.
  - Date d'annonce : `publishedAt` désormais prise en compte (seul
    `createdAt` l'était).
  - Bande blanche avant le pied de page supprimée (scopée à la page).
- [x] **Accueil** (`/`) — 13/10/2026. Vérifié en capture ordinateur et
      mobile ; page À propos comparée au pixel près avant/après (0 pixel
      d'écart, malgré le renommage des classes partagées `.value-card`).
  - Hero : bandeau des horaires de culte en pied de hero (paramètres du
    site), logo masqué sous 992 px.
  - **Défaut corrigé** : « Prochains événements » prenait les trois
    premiers de la liste, passés ou non — mi-octobre, l'accueil annonçait
    des rendez-vous d'août. Filtrage par la date réelle,
    `src/utils/eventDates.js` (7 tests), calculé au rendu. Aujourd'hui
    tous les événements publiés sont passés : la section affiche un état
    vide honnête.
  - Rangée tassée « événements / verset / message » éclatée en trois
    sections pleine largeur ; ministères en cartes photo (6) ; nouvelle
    section finale « Venez nous voir » (`HomeVisit`, horaires + adresse).
  - Classes de l'accueil préfixées `home-*` : fin des noms génériques
    (`.value-card`, `.icon`, `.line`, `.card`…) cités dans CLAUDE.md.
- [x] **À propos** (`/about`) — 13/10/2026. Vérifiée en capture
      ordinateur et mobile.
  - Mixins partagés créés : `src/styles/_ui.scss` (`eyebrow`,
    `section-title`, `pill-button`, `hero-breadcrumb`) — mixins et non
    classes, pour ne pas créer de `.btn` global. À utiliser pour la suite.
  - Valeurs : une icône distincte par valeur (cinq partageaient le même
    bouclier, « L'amour » avait une croix) ; accords corrigés
    (« Nous nous engageons… dans **son** ministère » → « notre »).
  - Mission : texte officiel conservé, résumé en six verbes tirés du
    texte (annoncer, conduire, accompagner, former, équiper, envoyer).
  - Bandeau chiffres et encart final réalignés sur la grille de page ;
    l'encart final mène aussi à `/inscription`.
- [x] **Ministères** (`/ministries`) — 13/10/2026. Vérifiée en capture
      ordinateur et mobile.
  - **Défaut corrigé** : débordement horizontal sur ordinateur (page de
    1462 px dans une fenêtre de 1440).
  - Cartes renommées `.ministries-grid__card` : l'ancienne `.ministry-card`,
    déclarée à la racine, s'appliquait aussi aux cartes de la page Contact
    (vérifié : la page Contact ne bouge que de quelques pixels d'icône).
  - Liens « En savoir plus » qui restaient en bleu navigateur.
  - Mixins partagés `stats-band` et `cta-band` (`_ui.scss`) : À propos et
    Ministères utilisent les mêmes, À propos vérifiée au pixel près
    (0 écart) après la mise en commun.
- [x] **Fiche ministère** (`/ministries/:slug`) — 13/10/2026. Vérifiée
      en capture ordinateur et mobile, état « introuvable » compris.
  - **Défauts corrigés**, même cause — le script `restore-ministries.js`
    a renommé les champs à la reprise en base, les composants n'ont pas
    suivi : les témoignages lisaient `message` (le champ est `quote`) et
    s'affichaient « «  » » vides ; les responsables lisaient
    `description` (le champ est `bio`), aucune présentation ne sortait.
  - Chiffres sortis du hero en bandeau ; sans chiffre, plus de carte
    « — Aucune statistique ».
  - État « Ministère introuvable » : la navigation (blanche, transparente)
    était invisible sur fond blanc — passé sur fond vert.
  - Noms génériques retirés : `.mission-card` (racine), `.container`,
    `.overlay`, `.event-card`, `.testimonial-card`, `.btn-primary`.
- [x] **Événements** (`/events`) — 13/10/2026. Vérifiée en capture
      ordinateur et mobile.
  - **Défaut corrigé** : la rubrique « À venir » listait tous les
    événements, passés compris. Séparation « À venir » / « Événements
    passés » (en retrait) par `utils/eventDates.js`.
  - **Défaut corrigé** : le calendrier marquait les jours d'événement avec
    des classes (`day--event`) qu'aucun style ne définissait — rien ne
    ressortait — et s'ouvrait sur le mois du premier événement (août).
    Réécrit : mois courant, aujourd'hui repéré, jours d'événement
    cliquables, même calcul de date que le reste du site (la
    reconstitution y était dupliquée).
  - « SEPTEMBRE » débordait de la pastille de date : mois court calculé.
- [x] **Fiche événement** (`/events/:slug`) — 13/10/2026. Vérifiée en
      capture ordinateur et mobile, état « introuvable » compris.
  - **Défaut corrigé** : hero et « Informations pratiques » lisaient
    `event.date`, champ inexistant — pastille de date vide, carte « Date »
    absente. `eventDateLabel()` (testé).
  - Événement passé : mention « Cet événement a eu lieu », et l'appel
    « Je participe / confirmer votre venue » est remplacé par l'agenda.
  - État introuvable sur fond vert (navigation invisible sur fond blanc),
    mixin `missing-state` partagé avec la fiche ministère.
  - Mixin `cta-centered` partagé avec la fiche ministère ;
    `.info-card` / `.speaker-card` (racine) renommées.
- [x] **Médias** (`/media`) — 13/10/2026. Vérifiée en capture ordinateur
      et mobile.
  - **Défaut corrigé** : débordement horizontal sur ordinateur (1446 px).
  - `Media.scss` redéfinissait hero (hauteur fixe 580 px), grille et cartes
    depuis l'extérieur : vidé, chaque composant porte ses styles.
  - `.meta` déclarée à la racine (dans une media query de `MediaCard`) et
    `.media-grid` renommées. Vignettes recadrées en 16/9 : une image
    carrée (le QR du média « test ») ne casse plus la grille.
  - Bandeau d'abonnement : liens sociaux lus dans les paramètres du site
    (ils étaient recopiés en dur).
- [x] **Sécurité des adresses de médias** — 13/10/2026.
  - L'API n'imposait **aucun protocole** au lien externe d'un média
    (`video.url`) ni à la source d'un fichier (`video.src`) : une adresse
    `javascript:` ou `data:` saisie dans `/admin` aurait fini dans un lien
    public. Validation ajoutée au modèle `Media` (`http(s)` pour un lien,
    chemin `/…` ou `https` pour un fichier) + `backend/src/models/Media.test.js`
    (3 tests, sans base). Les 13 médias en base sont conformes.
  - Seconde barrière côté site : `src/utils/safeUrl.js` (5 tests) appliqué
    aux liens de médias, au lecteur vidéo (identifiant YouTube revalidé)
    et aux liens sociaux du bandeau. **La validation API ne protège la
    production qu'une fois le backend redéployé.**
  - Mixin `page-hero` (`_ui.scss`) partagé par À propos, Événements et
    Médias (Événements vérifiée au pixel près ; À propos : écart mineur
    voulu, largeur du texte d'introduction unifiée).
- [x] **Appel à candidatures** (`/appel-a-candidature`, `/:slug`) —
      13/10/2026, refaite après une première passe d'harmonisation (à la
      demande : « il reste encore des pages à refaire »).
  - Hero sur le mixin `page-hero` (fil d'Ariane, deux boutons), en gardant
    les signatures de l'affiche : pastille inclinée, mots Vision · Service
    · Unité · Impact.
  - Titres de section : capitales grasses d'affiche → titre commun du site.
  - Conteneurs de section alignés sur celui du site (ils avaient 24 px de
    gouttière au lieu de 60 / 32 / 20).
  - Fiche d'un poste : fil d'Ariane, sur-titre « Poste ouvert », titre sans
    capitales forcées, conteneur du site. Filet de couleur du haut
    conservé (il reprend la couleur de la carte du poste, voulu).
  - `<main>` ajouté, bande blanche avant le pied de page retirée.
- [x] **Contact** (`/contact`) — 13/10/2026. Vérifiée en capture
      ordinateur et mobile.
  - **Défaut corrigé** : la confirmation d'envoi affirmait que le message
    était « conservé dans ce navigateur » — faux, l'API l'enregistre en
    base. Reformulée.
  - **Défaut corrigé** : coordonnées recopiées en dur et divergentes du
    pied de page — e-mail « info@cava.ci » (pied de page :
    eglise.cava2021@gmail.com), second numéro « +225 27 22 23 71 97 »
    (pied de page : 27 22 33 11 96), repère « non loin de l'institut des
    jésuites ». Désormais lues dans les paramètres du site. **À vérifier
    par l'église** : laquelle des deux versions était la bonne.
  - **Défaut corrigé** : « Voir l'itinéraire » ouvrait maps.google.com
    sans adresse. Ouvre maintenant une recherche sur l'adresse de l'église.
  - Zone de message en police à chasse fixe (`font: inherit` manquant) ;
    libellés visibles au-dessus des champs (ils n'étaient que des
    placeholders) ; longueurs maximales alignées sur l'API ; numéros et
    e-mail cliquables (`tel:`, `mailto:`).
  - `.schedule-card` (racine) renommée ; gouttières doublées de
    `MinistryContacts` sur mobile retirées.
- [x] **Don** (`/donate`) — 13/10/2026, refaite en deux temps. **Logique
      du tunnel intacte** (15 tests au vert) : seules l'apparence et les
      jetons de style ont changé.
  - Jetons de `styles/_donate.scss` réglés sur le langage du site : fond
    alterné crème, sur-titre et titre communs (mixins `_ui.scss`),
    conteneur commun (1400 px — la page avait le sien à 1240 px et ne
    s'alignait pas sur la navigation).
  - Hero sur le mixin `page-hero` (fil d'Ariane, « Choisir un type de
    don » en second bouton).
  - Montants sur mobile : trois colonnes au lieu d'une (les cinq montants
    occupaient tout un écran de téléphone).
- [x] **Inscription** (`/inscription`) — 13/10/2026. Hero sur le mixin
      `page-hero` (fil d'Ariane via Communauté, bouton « Commencer mon
      inscription »), badge matricule conservé ; fond du formulaire crème.
      Tunnel intact (41 tests au vert). `<main>` ajouté.
- [x] **Pages légales** — hero partagé `LegalHero` passé sur le mixin
      `page-hero` (sur-titre « Informations légales ») ; contenu inchangé
      (colonne de lecture déjà claire).
- [x] **Désinscription** (`/desinscription`) — **défaut corrigé** : la
      navigation (blanche, transparente) était invisible sur le fond
      clair. Fond vert, carte blanche conservée.
- [x] **404** — vérifiée. `.btn-primary`, `.btn-secondary`,
      `.quick-links` et `.particles` étaient déclarées à la racine de
      `NotFound.scss` (classes globales) : préfixées `.not-found`, rendu
      inchangé (vérifié au pixel près sur ordinateur).

## Vérification finale (13/10/2026)

- Build de production : OK.
- Tests frontend : **203 / 203** (dont 24 nouveaux : `richText`,
  `eventDates`, `safeUrl`).
- Tests backend : **529 / 529** (dont 3 nouveaux : `models/Media.test.js`).
- ESLint : aucun problème.
- CSS compilée : aucune des classes génériques visées (`.card`, `.icon`,
  `.line`, `.overlay`, `.badge`, `.meta`, `.day`, `.dot`, `.container`,
  `.btn-*`…) ne subsiste à la racine.
- Aucune page publique en débordement horizontal (1440 px et 390 px),
  vérifié page par page après la dernière passe.

## Corrections transversales

- [x] **Pied de page rogné sur mobile, sur toutes les pages** —
      `grid-template-columns: 1fr` → `minmax(0, 1fr)` dans `Footer.scss`.
      Le champ newsletter élargissait la colonne au-delà de l'écran.
      Vérifié en capture mobile.

## Points relevés, non traités (à décider)

- **Groupes de maison fictifs** : `HomeGroups` affiche quatre groupes
  écrits en dur (« Famille Koffi », « Famille Bamba »…) — le même
  problème que les faux témoignages retirés auparavant. Les bergeries
  existent en base ; les afficher demanderait une route publique qui
  n'expose que des champs non personnels.
- **« 35 quartiers » pour 45 membres** : chiffre probablement gonflé par
  des graphies différentes d'un même quartier dans le registre.
- **Média « test »** daté du 01/01/2922 en base, visible publiquement.
- **Aucun événement à venir publié** : les trois événements en base sont
  d'août-septembre 2026. À compléter depuis `/admin`.
- **Liens sociaux factices** dans le pied de page de toutes les pages :
  `facebook.com`, `instagram.com`, `youtube.com` et un WhatsApp
  `wa.me/2250712345678` — valeurs de repli de `content/settings.js`, faute
  de liens renseignés dans les paramètres du site.
- **Chiffres de la page À propos** (« + 1500 vies impactées », « + 25
  groupes de maison », « + 30 bénévoles », « + 10 années ») : écrits en
  dur, à faire confirmer — ils contredisent le registre (4 serviteurs) et
  la page Communauté (4 groupes de maison).
- **Contenu des fiches ministère** (responsables « Fr. Samuel Kouassi »…,
  témoignages « Sarah K. », « Akissi N. »…, chiffres « 150+ membres ») :
  repris de l'ancien contenu en dur par `restore-ministries.js`. Ils
  étaient invisibles (bug de champ) et s'affichent désormais : à faire
  confirmer par l'église, comme l'ont été les faux témoignages de la
  page Communauté.
- **Dernier message** signé « Pasteur Jean Koffi » (04/05/2025) : à
  vérifier, ressemble à un contenu d'amorçage.
