# Suivi — refonte de l'espace d'administration et du badgeage

Démarrée le 13 octobre 2026, à la suite de la refonte du site public
(voir [SUIVI-REFONTE-SITE.md](SUIVI-REFONTE-SITE.md)).

Règle : une case n'est cochée que si l'écran a été **ouvert et regardé**
(capture Chrome headless, bureau 1440 px et mobile 390 px), pas seulement
écrit.

## Méthode de vérification

L'administration exige une session. Les captures se font avec une
**session fictive** (faux jeton dans le `localStorage`) et des **réponses
d'API simulées** par interception Chrome (`Fetch.requestPaused`) : aucune
requête n'atteint l'API ni la base. Autorisé explicitement par
l'utilisateur le 13/10/2026 (option « A »).

Conséquence : les écrans sont vérifiés avec des données inventées. Les
formes de réponse sont reprises des services backend, mais un écart reste
possible — un essai avec un vrai compte reste nécessaire avant mise en
production.

## Socle

- [x] Mixins communs dans `styles/_admin.scss` : `admin-page-head`,
  `admin-panel`, `admin-kpi-grid`, `admin-kpi-icon($tone)`,
  `admin-kpi-value`, `admin-kpi-label`, `admin-button($variant)`,
  `admin-chip`, `admin-chip-active`, `admin-field`,
  `admin-status-pill($tone)`. Des mixins, jamais des classes (feuille
  unique).
- [x] Ombres à deux couches, rayon des petits éléments 9 px.
- [x] Navigation extraite dans `pages/admin/adminNav.js` (menu, fil
  d'Ariane et recherche rapide partagent la même liste) — testée.

## Cadre (AdminLayout)

- [x] Fil d'Ariane dans l'en-tête (groupe › page, « Détail » pour une
  fiche) ; sur mobile, le nom de la page seul.
- [x] Recherche rapide **Ctrl+K / ⌘K** (ou « / ») : ne propose que les
  pages permises au rôle, insensible aux accents, clavier complet.
- [x] Outils regroupés (notifications, thème, actualiser).
- [x] Menu du compte : nom, identifiant, rôle en clair, site public,
  déconnexion.
- [x] Captures bureau clair/sombre, mobile.

## Sécurité (session)

- [x] **Revalidation au chargement** (`revalidateSession`, `/api/auth/me`) :
  un jeton expiré ou révoqué renvoie vers la connexion au lieu d'un
  tableau de bord rempli d'erreurs. Le rôle renvoyé par le serveur
  remplace celui mémorisé. Une panne réseau ou une erreur 500 ne
  déconnecte pas (vérifié : 401 → connexion, 500 → reste).
- [x] **Signal d'expiration** (`SESSION_EXPIRED_EVENT`, `http.js`) : tout
  401 sur la session stockée renvoie vers la connexion. Rien n'est émis
  pour un mauvais mot de passe, un code 2FA erroné ou le jeton du
  badgeage — testé.
- [x] **Déconnexion après 30 min d'inactivité**, avertissement 60 s avant
  (`useIdleTimeout`), horodatage partagé entre onglets — vérifié en
  accélérant l'horloge (alerte puis connexion avec le motif).
- [x] Déconnexion dans un autre onglet suivie partout (événement
  `storage`).
- [x] L'écran de connexion explique pourquoi la session s'est fermée, et
  n'accepte pour `from` qu'un chemin interne `/admin…`.
- [ ] À décider (backend) : `JWT_EXPIRES_IN` vaut **7 jours** par défaut.
  La déconnexion pour inactivité protège le poste, pas un jeton volé.

## Pages

Toutes vérifiées en capture (bureau 1440 px, mobile 390 px ; échantillon
en thème sombre), sans débordement horizontal ni élément coupé — détecteur
validé sur un débordement provoqué.

| Page | État |
|---|---|
| Tableau de bord | [x] refait : « À traiter » (messages, inscriptions, nouvelles âmes), publication, contenu, messages, actions rapides filtrées par rôle ; variantes agent et Service Social |
| Listes génériques (AdminCrud : médias, événements, ministères, postes, témoignages, types…) | [x] en-tête, recherche, boutons, cadre du tableau ; option `headingLevel` |
| Agents | [x] refait (était hors charte) ; tableau en cartes sur mobile |
| Dons | [x] cartes à icône, filtres, tableau en cartes sur mobile |
| Messages, Lettre d'information, Paramètres, Badgeage (admin) | [x] en-tête commun ; Paramètres : description sous le titre |
| Communauté | [x] titre de page, onglets dans l'URL (`?onglet=submissions`), onglets défilants sur mobile, titres de section en `h2` |
| Nouvelles âmes | [x] en-tête, chiffres, répartition par étape en barres (le libellé était écrit deux fois) |
| Portail bergerie | [x] couleurs en dur remplacées par les jetons (restait blanc en thème sombre) |
| Service Social (7 écrans) | [x] en-têtes, cartes, filtres, totaux |
| Enfants (9 écrans) | [x] en-tête, cartes, panneaux ; fil d'Ariane interne seulement sur fiche/création |
| Formulaires et fenêtres | [x] vérifiés clair/sombre |
| Connexion admin | [x] motif de fin de session |
| Badgeage `/presences` — connexion agent | [x] vérifié clair/sombre |
| Badgeage `/presences` — scanner | [x] **débordement mobile corrigé** (bloc de scan coupé à droite), bouton de thème dans la barre de session, contenu centré sur grand écran, icônes lisibles en sombre |
| Espace moniteur `/monitorat` | [x] connexion refaite (bandeau, afficher le mot de passe), colonne centrée sur ordinateur ; revalidation sans déconnexion sur coupure réseau |

Mesures finales (13/10/2026) : **222 tests frontend** (19 nouveaux),
ESLint propre, build propre.

## Défauts trouvés en route

- Le tableau de bord affichait le statut brut d'un message (« REPONDU »,
  sans accent) : libellés centralisés dans `pages/admin/messageStatus.js`.
- Le raccourci « Nouvelles âmes » s'affichait à un éditeur, qui n'y a pas
  accès : raccourcis filtrés par rôle.
- `revalidateSession` acceptait une réponse sans rôle comme profil (le
  menu se vidait) : un profil n'est enregistré que s'il porte un rôle.
- Le panneau « Diagnostic caméra (mode test) », temporaire depuis la
  panne Android de septembre, est toujours visible des agents — à
  décider.
- ~120 couleurs fixes `$primary` dans l'admin ignoraient le thème sombre
  (vert foncé sur fond sombre) : remplacées par `$admin-accent`.
- Le scanner utilisait déjà un jeton `--presence-accent` jamais défini,
  comme FOND de boutons : le nouveau jeton d'icônes s'appelle
  `--presence-accent-ink` pour ne pas le réveiller.
- Plusieurs boutons s'affichaient en Arial (police non héritée) :
  règle de spécificité nulle `:where(.admin-shell) :where(button…)`.
- L'espace moniteur déconnectait sur toute erreur au chargement, coupure
  réseau comprise : passé sur `revalidateSession` (seuls 401/403
  déconnectent) ; l'ancienne `refresh()` est supprimée.
- Le serveur de dev peut garder une feuille en échec après une erreur
  Sass corrigée : en cas de doute, vérifier le style CALCULÉ (sonde CDP)
  plutôt que la capture.
