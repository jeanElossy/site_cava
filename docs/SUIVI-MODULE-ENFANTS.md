# Suivi des travaux — Module Enfants & École du dimanche

Dernière mise à jour : 1ᵉʳ septembre 2026 (6ᵉ passe).

État global : **module déployé en production**, puis **corrigé deux fois
sur des défauts que la suite de tests ne voyait pas**. Voir le lot 10.

| Vérification | Résultat |
|---|---|
| Tests backend | **420 / 420** (334 avant le chantier, **+86 neufs**) |
| Tests frontend | **108 / 108** (87 avant, **+21 neufs**) |
| `npm run build` | ✅ |
| `eslint src` | ✅ aucun avertissement |
| Fuite de classe SCSS générique | ✅ aucune (vérifié sur le CSS compilé) |

> ⚠️ **Ce fichier a déjà menti une fois.** Il déclarait le lot 6
> « ✅ TERMINÉ — 5 écrans » alors que l'écran de création d'un enfant
> n'existait pas : le bouton « Nouvel enfant » du tableau de bord
> pointait vers une route absente. Une case cochée ici ne vaut que si
> l'écran a été **ouvert**, pas seulement écrit.

Ce fichier suit le chantier d'ajout au Back Office d'un module de gestion
des enfants, des classes de l'École du dimanche, des moniteurs et de leurs
remplacements temporaires — avec un espace mobile dédié aux moniteurs.

Le diagnostic complet (sections A à T demandées au cahier des charges) est
consultable ici :
**https://claude.ai/code/artifact/e694115b-e52c-4e1a-961f-6c5cb0fbffcd**

---

## Où en est le chantier

| Phase | Contenu | État |
|---|---|---|
| 1 | Audit du projet existant | ✅ terminée |
| 2 | Diagnostic et architecture proposée (A → T) | ✅ terminée |
| 3 | Implémentation (9 lots) | ✅ terminée — lots 1 à 8 |
| 4 | Tests | ✅ terminée — 94 tests neufs |
| 5 | Rapport final | ✅ rendu le 1ᵉʳ septembre |
| — | **Lot 10 — défauts trouvés en production** | 🔧 **en cours** |

---

## Ce qui a été établi en Phase 1 — audit

Points de l'existant qui commandent toute la suite :

- **`Member` n'a pas de mot de passe** et n'en aura pas : le commentaire du
  modèle le dit explicitement. Seul `User` porte une authentification.
- **Deux identifiants de connexion, une seule route.** `POST /api/auth/login`
  reçoit un champ `identifier` unique ; `findUserByIdentifier` choisit
  e-mail ou matricule d'après la forme de la valeur. Les agents SOA/CANA et
  tout le Service Social se connectent déjà par matricule.
- **RBAC plat.** Un champ `User.role` (10 valeurs) et `requireRole(...)`
  route par route. Ni collection `Permission`, ni permissions par ressource,
  ni rôles multiples. Le module doit s'y conformer.
- **Portées de jetons.** Quatre jetons circulent, signés avec le même secret
  mais séparés par un `scope` vérifié à chaque middleware — c'est le
  mécanisme qui empêche le jeton intermédiaire de 2FA d'ouvrir
  l'administration.
- **Aucun cloisonnement par église** n'existe aujourd'hui : capacité à
  ajouter, pas à réutiliser.
- **Aucune notion de mot de passe temporaire.** `agent.service.js#resetPassword`
  pose un mot de passe définitif, sans jamais forcer son changement.
- **Tout envoi de fichier produit une URL Cloudinary publique et permanente**
  (`type: upload`). Incompatible en l'état avec des documents d'enfants.

---

## Validation du diagnostic — 27 août 2026

Les cinq décisions ont été validées telles quelles. Le matricule ne bouge pas :
`1ME19016P`.

---

## Décisions d'architecture prises en Phase 2

### D1 — Le matricule du cahier des charges n'existe pas ⚠️

Le cahier des charges donne `CAVA-2026-00125`. Le format réel du projet est
`1ME19016P` (9 caractères, voir `utils/registrationFormat.js`), et le schéma
`User` **rejetterait** l'autre forme.

**Retenu :** le moniteur se connecte avec son matricule de membre réel. Aucun
développement nécessaire — c'est déjà l'identifiant des agents de terrain.

Le numéro de dossier enfant `CAVA-ENF-000001`, lui, est conservé tel quel :
il n'entre en conflit avec rien et sera généré par un compteur atomique
calqué sur `SocialCounter`.

### D2 — Documents privés : Cloudinary `type: authenticated`

Le mode `upload` actuel rend l'URL publique à vie. Pour les actes de
naissance et autorisations parentales : envoi en `authenticated`, puis URL
signée à expiration courte, générée à la demande par l'API et **journalisée**.

Le relais par le backend a été écarté (chaque consultation traverserait
l'instance Render), pour la même raison qui avait fait choisir la signature
plutôt que le relais à l'envoi.

### D3 — Espace moniteur sur `/monitorat`

Coquille mobile séparée, comme `/presences`, sous le même interrupteur
`VITE_ENABLE_ADMIN` — et non une navigation filtrée dans `/admin`. Même
connexion, même jeton `cava:token`, interface entièrement repensée pour le
téléphone.

### D4 — Responsables en collection propre

Une fratrie partage ses parents. `ChildGuardian` en collection reliée évite
de ressaisir la même mère pour trois enfants, au prix d'une jointure.
Rapprochement automatique avec `Member` quand le parent est déjà membre CAVA.

### D5 — Aucun job d'expiration des remplacements

L'expiration se **calcule** à chaque lecture (`isSubstitutionActiveAt`), elle
ne se stocke pas. Un job nocturne laisserait l'accès ouvert entre la fin
réelle et son passage. Le statut ne connaît que deux valeurs décidées par un
humain : `valide` ou `annule`.

Même raisonnement que `getEffectiveWindow` pour les QR de badgeage.

### D6 — `"moniteur"` n'entre pas dans `AGENT_ROLES`

Ce tableau pilote `loadAgentOrThrow` dans `agent.service.js` : y ajouter le
rôle ferait apparaître les moniteurs dans `/admin/agents`, où on pourrait les
modifier sans toucher à leur affectation de classe. Un service dédié
`monitorAccount.service.js` reprend le même code de garde en gardant les deux
mondes étanches.

### D7 — Un seul point de décision pour l'accès aux classes

`resolveMonitorAccess(memberId, { at })` est la **seule** fonction qui décide
quelles classes un moniteur peut voir. Appelée par le middleware et par la
route `/monitorat/classes`. C'est la leçon de `isPresenceAgent` : trois
endroits qui prennent la même décision séparément finissent par diverger, et
la connexion passe pendant que chaque requête suivante échoue.

---

## Apports des maquettes — `design-page-enfant/`

15 maquettes uniques (sur 21 fichiers, 6 doublons exacts). Ce qu'elles ont
tranché ou ajouté :

### Couleur : vert, blanc et jaune de l'église ✅ tranché

Consigne du client, 1ᵉʳ septembre : **« utilise les couleurs vert, blanc et
jaune de l'église CAVA »**. Chacune garde le rôle qu'elle a déjà partout sur
le site :

| Couleur | Rôle |
|---|---|
| **Blanc** | les surfaces — cartes, fonds (`$admin-surface`) |
| **Vert** | les données — `$primary` `#0d5b3e` et ses étapes plus claires |
| **Jaune** | la **mise en avant** — un seuil, une alerte, la valeur du jour (`$secondary`). Jamais une série parmi d'autres : une couleur d'accent qui sert aussi de série ne peut plus rien signaler |

#### Les graphiques : une rampe verte, et pourquoi

Les classes ne sont pas des catégories quelconques — elles sont **ordonnées
par âge** (03-05, 06-08, 09-12). Une progression du vert clair au vert profond
dit donc quelque chose de vrai, là où quatre teintes sans rapport ne diraient
rien. C'est aussi ce qui permet de tenir la consigne : deux couleurs de marque
ne peuvent pas fournir quatre teintes catégorielles distinctes, mais une seule
suffit à bâtir une rampe.

**Rampe retenue :** `#5cc79a → #22a173 → #157a56 → #0d5b3e` — sa dernière
étape *est* le vert CAVA. Vérifiée par le validateur de palette, en thème
clair **et** sombre : clarté strictement croissante, écart ≥ 0,06 entre étapes
voisines, teinte unique (1° d'écart), extrémité claire détachée de la surface.

> ⚠️ **La palette des maquettes a été écartée, et c'est mesuré.** Le donut des
> maquettes place un bleu et un violet côte à côte : ΔE **1,3** en
> deutéranopie, et **12,0** en vision normale — au-dessous du plancher de 15,
> donc difficiles à distinguer *même avec une vision des couleurs normale*.
> Les reproduire aurait produit un graphique illisible pour une partie des
> utilisateurs.

#### Le vert du back office pour le reste

Les maquettes les plus anciennes (23h19–23h21) sont en indigo ; les plus
récentes (23h29 et après) sont déjà passées au vert. On utilise les jetons
`--admin-accent`, `--admin-rail` etc. définis dans `AdminLayout.scss`, jamais
une seconde palette.

### (historique) Le basculement indigo → vert des maquettes

Les maquettes les plus anciennes (23h19 à 23h21) sont en indigo/violet ; les
plus récentes (23h29 et après) sont passées au **vert CAVA**. Confirmé
explicitement par le client : on utilise les jetons `--admin-accent`,
`--admin-rail` etc. déjà définis dans `AdminLayout.scss`, jamais une seconde
palette.

### Structure d'écran récurrente

Toutes les pages suivent le même gabarit, qui devient un composant partagé
plutôt que d'être recopié douze fois :

```
Titre + fil d'Ariane + bouton d'action principal
Bande de 4–5 cartes de statistiques (valeur, libellé, évolution)
Barre de filtres (recherche + selects + « Filtres avancés » + « Réinitialiser »)
Tableau paginé              │  Colonne latérale droite :
                            │   calendrier, alertes, actions rapides, aide
```

### Ce que les maquettes ont ajouté aux modèles

| Élément | Conséquence |
|---|---|
| Documents avec statut **Validé / En attente** | `ChildDocument.status` + `reviewedBy` / `reviewedAt` |
| Document « ajouté par Marie ASSOGBA, Mère » | Auteur **polymorphe** (`user` ou `guardian`) — un responsable n'a pas de compte. Même montage que `authorSchema` dans NewSoul.js |
| « 8.4 Mo sur 50 Mo autorisés », « 5 Mo max » | `CHILD_DOCUMENT_QUOTA_BYTES`, `CHILD_DOCUMENT_MAX_BYTES`, formats PDF/JPG/PNG — **dans les paramètres signés Cloudinary**, pas seulement côté navigateur |
| Nationalité, langue parlée à la maison, adresse | Ajoutés à `Child` (la question Q3 est donc tranchée : on les implémente) |
| Classes avec émoji, salle, jour et heure habituels | `SundaySchoolClass.icon` / `usualDay` / `usualStartTime` / `usualEndTime` |
| Séances avec thème, horaires, statut | `ChildSession` |
| Remplacements en onglets **Actifs / À venir / Passés** | Confirme D5 : ces trois états sont **calculés**, pas stockés |
| Notion de **Famille** (`CAVA-FAM-00045`) | ⚠️ Non implémentée — voir Q5 |
| Écran « Événements enfants » autonome | ⚠️ Voir Q6 |

### Ce que les maquettes NE dictent pas

- Le matricule moniteur y apparaît en `CAVA-2026-00125` : format inexistant,
  déjà tranché (D1). On garde `1ME19016P`.
- Le moniteur principal apparaît sur la fiche enfant : il est **dérivé de la
  classe**, jamais stocké sur l'enfant (sinon un changement de moniteur
  obligerait à repasser sur tous les enfants de la classe).

---

## Une seule église pour le moment

Confirmé par le client le 28 août 2026. L'église 1 est la seule réelle ; les
églises 2 à 5 restent des bacs à sable de test.

Conséquences retenues :

- Les classes réelles sont créées dans l'**église 1**.
- Le sélecteur d'église des maquettes (« CAVA Abidjan ») reste à l'écran mais
  n'a qu'une entrée : il ne devient pas un élément structurant de la navigation.
- `User.church` est en place et **sans effet** tant qu'il n'y a qu'une église.
  C'est voulu : le champ coûte une ligne aujourd'hui et évitera une migration
  le jour d'une seconde assemblée. La question Q2 est donc sans objet à court
  terme.
- Les suites de tests utilisent l'**église 2** — voir la note de risque n°4.

---

## ✅ Import du registre — fait le 1ᵉʳ septembre 2026

**25 enfants et 3 classes créés en base de production** (`cava-eglise` sur
MongoDB Atlas), par `backend/src/scripts/seed-children-registry.js --apply`.
Les collections étaient vides : aucun écrasement.

| Classe | Enfants |
|---|---|
| 🧸 03 à 05 ans | **13** |
| 🎨 06 à 08 ans | **3** |
| 📖 09 à 12 ans | **9** |
| **Total** | **25** — numéros `CAVA-ENF-000001` à `CAVA-ENF-000025` |

Fratries confirmées : **LIADE (7)**, ZADI (4), ADJAFFI (3), YE (2),
AMALAMAN (2). Sept enfants LIADE : c'est la justification concrète de la
décision D4 (responsables en collection partagée).

### Les quatre doublons, tranchés et tracés

- **KOUASSI Affout Nael** figurait sur les *deux* feuilles « 03 à 05 ans » —
  même classe, donc une seule fiche. Cas simple.
- **ADJAFFI Jean David**, **LIADE Abdullam** et **LIADE Rehoboth Isaac**
  figuraient sur « 06 à 08 » *et* « 03 à 05 ». Rattachés à la classe **la plus
  âgée**, pour une raison précise : la feuille 06-08 ne contient qu'eux trois,
  ce qui évoque une promotion récente — un enfant passe à la classe suivante,
  jamais l'inverse.

**Le choix est inscrit dans leurs notes internes**, visible sur leur fiche. Il
se corrige d'un clic depuis l'administration, et l'équipe sait pourquoi il a
été fait. ⚠️ **À confirmer auprès du responsable.**

### Ce que le registre ne disait pas

Ni date de naissance, ni sexe, ni responsables. Ces champs restent **vides** :
les deviner à partir des prénoms (« Chance », « Bénie »…) aurait produit des
données fausses présentées comme sûres. Les 25 fiches portent
`source: "registre"` et remontent dans la liste avec le filtre
**« À compléter uniquement »**.

---

## Le registre papier réel — reçu le 27 août 2026

Trois classes, et **non les quatre des maquettes** :

| Classe réelle | Maquettes (à ignorer) |
|---|---|
| **03 à 05 ans** | Petits (3–5 ans) |
| **06 à 08 ans** | 6–8 ans |
| **09 à 12 ans** | 9–11 ans **et** Pré-ados (12–14 ans) |

**~25 enfants distincts** sur 29 lignes — le registre porte des doublons entre
feuilles (voir Q7). Familles nombreuses : **LIADE (7 enfants)**, ZADI (4),
ADJAFFI (3), AMALAMAN (2), YE (2), VOUEBOU (2).

Ces 7 enfants LIADE confirment concrètement la décision D4 : avec des
responsables embarqués dans chaque fiche, les mêmes parents auraient été
saisis sept fois.

**Conséquence sur le modèle** (appliquée) : le registre ne porte que des noms —
ni date de naissance, ni sexe. `Child.dateOfBirth` et `Child.gender` sont donc
**facultatifs au niveau du schéma** et exigés par le formulaire de création. Un
champ `source: "registre"` et un virtuel `missingFields` signalent les dossiers
à compléter, plutôt que d'inventer des dates pour satisfaire une contrainte.

---

## Questions encore ouvertes

| # | Question | Impact si non tranchée |
|---|---|---|
| Q1 | Rétention du journal d'audit : `AuditLog` a un TTL de 12 mois. La trace « qui a consulté l'acte de naissance de X » disparaîtra au bout d'un an. Allonger suppose un second modèle (Mongo n'applique qu'une durée par index). | Par défaut : TTL conservé et documenté. |
| ~~Q2~~ | ~~Portée par église du responsable~~ | ⏸️ **Sans objet** : une seule église pour le moment. Le champ existe, sans effet. |
| ~~Q3~~ | ~~Champ « nationalité »~~ | ✅ **Tranchée** : présente dans les maquettes, donc implémentée (facultative). |
| Q4 | Fonctionnalité de sortie/récupération (§28) : activable par activité — quelles activités par défaut ? | Par défaut : désactivée partout, activée séance par séance. |
| Q5 | Notion de **Famille** (`CAVA-FAM-00045`, vue sur une seule maquette) : entité stockée avec son propre numéro, ou simple regroupement calculé à partir des responsables partagés ? | Par défaut : calculée, pas de modèle `Family`. |
| Q6 | Écran « Événements enfants » : réutiliser `Event` + `childClasses[]` (décidé, §27 « ne pas créer un deuxième système ») ou modèle distinct ? La maquette montre des types propres (Fête, Enseignement, Sport, Atelier, Sortie) et un suivi d'inscrits. | Par défaut : `Event` + `childClasses[]`, types ajoutés à `Event`. |
| ~~Q7~~ | ~~Doublons du registre~~ | ✅ **Tranchée à l'import** — voir la section ci-dessus. Reste à confirmer auprès du responsable. |
| ~~Q8~~ | ~~Deux feuilles « 03 à 05 ans »~~ | ✅ **Fusionnées** en une seule classe de 13 enfants. |

---

## Phase 3 — plan d'implémentation

Ordre imposé par le cahier des charges (§45). Les deux premiers lots sont les
seuls capables de casser l'existant : ils passent en premier, isolément, avec
la suite backend complète exécutée avant de continuer.

### Lot 1 — Socle d'authentification ✅ TERMINÉ

- [x] `User.js` : rôles `moniteur` / `responsable_ecole_dimanche`, champs
      `passwordChangeRequired`, `passwordChangedAt`, `church`
- [x] `middlewares/auth.js` : scope `PASSWORD_CHANGE` + `signPasswordChangeToken`
      / `verifyPasswordChangeToken`
- [x] `requireAuth` refuse un jeton de session dont le compte est repassé en
      mot de passe temporaire — une réinitialisation coupe la session en cours,
      sinon elle n'aurait fermé aucune porte
- [x] `auth.service.js` : `completeLogin` comme **point de sortie unique** des
      deux chemins de connexion, + `changeFirstPassword`
- [x] La 2FA passe **avant** le mot de passe temporaire : l'inverse permettrait
      à qui connaît le mot de passe temporaire — à commencer par
      l'administrateur qui l'a créé — de s'approprier le compte sans franchir
      le second facteur
- [x] Route `POST /api/auth/first-password`, sous `loginLimiter`
- [x] **Non-régression vérifiée : 334 tests, 0 échec**, dont les 8 tests des
      4 voies de connexion existantes
- [x] 13 tests neufs : `services/firstPassword.service.test.js`

### Lot 2 — Modèles base de données ✅ TERMINÉ

- [x] `Child`, `ChildCounter`, `ChildGuardian`, `ChildDocument`
- [x] `SundaySchoolClass`, `MonitorAssignment`, `MonitorSubstitution`
- [x] `ChildSession`, `ChildAttendance`, `ChildCheckout`
- [x] `AuditLog` : +6 valeurs d'enum, avec l'avertissement sur l'enum fermé
- [x] `Event` : + `childClasses[]`
- [x] `utils/childFileNumber.js` + `utils/substitutionWindow.js` (fonctions pures)
- [x] `utils/cloudinaryUrl.js` : `isTrustedChildPhotoUrl` et
      `isTrustedChildDocumentUrl` — ce dernier **exige** le mode
      `authenticated`, ce qui rend une URL publique impossible à enregistrer
- [x] Index, dont les uniques `{child, session}` (idempotence de l'appel),
      `{class, date}` (une séance par classe et par jour) et
      `{church, name}` (deux classes homonymes seraient indiscernables)
- [x] 29 tests neufs sur les fonctions pures, dont **12 sur l'expiration des
      remplacements** — la règle de sécurité centrale du module

### Lot 3 — Documents privés ✅ TERMINÉ

- [x] `upload.service.js` : dossiers `children` et `childrenDocuments`,
      **mode `authenticated` signé** (le navigateur ne peut donc pas demander
      un envoi public dans ce dossier), formats signés
- [x] `isTrustedChildDocumentUrl` — **exige** le mode `authenticated` : une URL
      publique devient impossible à enregistrer, quel que soit le chemin d'écriture
- [x] `createPrivateDownloadUrl` : URL signée **et datée** (5 min). Une simple
      « signed URL » Cloudinary n'expire jamais — inacceptable pour une pièce
      d'état civil de mineur
- [x] `fetchResourceInfo` : la **taille réelle** est demandée à Cloudinary avant
      d'enregistrer. Cloudinary sait imposer un format mais pas un plafond de
      taille, et la vérification du navigateur se contourne
- [x] 🔒 **Faille fermée au passage** : `/api/admin/uploads/signature` n'exigeait
      que `requireAuth` — tout compte authentifié (agent SOA, Service Social,
      moniteur) aurait pu déposer dans l'espace des documents d'enfants. Une
      table `FOLDER_ROLES` dans le service ferme les dossiers sensibles. Les
      dossiers historiques restent ouverts comme avant
- [x] 16 tests : `services/upload.service.test.js`
- [ ] Journalisation `document_view` — câblée avec les routes (lot 5)

### Lot 4 — Services backend ✅ TERMINÉ

- [x] `childNumber.service.js` (compteur atomique) + `childFileNumber.js` (pur)
- [x] `child.service.js` — dont le filtre par âge traduit en fenêtre de dates
      de naissance (l'âge n'est pas stocké), et l'historique **paginé**
- [x] `childGuardian.service.js` — rapprochement automatique avec `Member`,
      suppression refusée tant qu'un enfant y est rattaché
- [x] `sundaySchoolClass.service.js` — effectifs en **2 requêtes groupées**
      quel que soit le nombre de classes (pas de N+1), archivage refusé si la
      classe compte encore des enfants actifs
- [x] `monitor.service.js` — **`resolveMonitorAccess()`**, point de décision
      unique de tout le module
- [x] `monitorAccount.service.js` — comptes et mot de passe temporaire.
      Alphabet **sans caractères ambigus** (ni O/0, ni I/l/1) : ce mot de passe
      est dicté à voix haute avant d'être saisi sur un téléphone
- [x] `substitution.service.js` + `substitutionWindow.js` (pur) — état
      « actif / à venir / terminé » **calculé**, détection de conflits
      applicative (MongoDB ne sait pas indexer un intervalle)
- [x] `childAttendance.service.js` — appel en **un seul `bulkWrite`** ;
      contrôle d'accès **au moment de l'écriture**, pas seulement à l'affichage
- [x] `childDocument.service.js` — `publicDocument` ne renvoie **jamais**
      `url` ni `publicId` : ensemble, ils permettraient de fabriquer un lien
      hors de tout contrôle
- [x] 14 tests d'intégration : `services/monitor.service.test.js`
- [ ] `childStats.service.js` — avec les tableaux de bord (lot 8)

### Lot 5 — API ✅ TERMINÉ

- [x] `middlewares/monitorAuth.js` — `requireMonitor`, `requireClassAccess`,
      `resolveClassFromSession`
- [x] `routes/children.routes.js` → `/api/admin/enfants` (33 routes)
- [x] `routes/monitor.routes.js` → `/api/monitorat` (10 routes)
- [x] Montage dans `routes/index.js` (2 lignes)
- [x] Journalisation `document_view` câblée sur la délivrance de lien
- [x] 19 tests de sécurité : `routes/children.routes.test.js`

> 🐛 **Défaut trouvé PAR ces tests, et corrigé.**
> `GET /monitorat/seances/:id/appel` répondait **200 sur une classe
> interdite**. La route appelait `requireClassAccess` depuis l'intérieur du
> handler, en lui passant une callback maison : ce middleware est un
> `asyncHandler`, qui signale un refus par `next(erreur)` — une callback qui
> ignore son premier argument s'exécute alors comme si l'accès avait été
> accordé.
>
> Corrigé par un middleware `resolveClassFromSession` **chaîné** normalement,
> et le piège est documenté en tête de `monitorAuth.js`. Les trois routes
> d'écriture passent désormais elles aussi par la chaîne, en défense en
> profondeur — leur service faisait déjà le contrôle, d'où leur succès dès le
> premier essai.

### Lot 6 — Administration frontend ✅ TERMINÉ

- [x] `roleGroups.js` (+ `CHILDREN_ROLES`, `CHILDREN_ACCESS_ROLES`,
      `MONITOR_ONLY_ROLES`), `RequireRole.jsx` (repli vers `/monitorat`),
      `AdminRoutes.jsx`, `AdminLayout.jsx` (groupe « Enfants »)
- [x] `services/children.js` — dont `openDocument`, qui ne met **jamais** en
      cache l'URL signée obtenue
- [x] `components/children/ChildrenPage/` — gabarit partagé (titre, fil
      d'Ariane, cartes de statistiques, filtres, colonne latérale). Les
      maquettes répètent la même structure douze fois ; la recopier
      garantirait qu'elles divergent au premier ajustement
- [x] 5 écrans : tableau de bord, liste, classes, moniteurs, remplacements
- [x] **Création d'un enfant** (`ChildForm.jsx`) — ⚠️ **manquait**, alors que
      ce lot était coché « terminé » et que deux écrans pointaient déjà vers
      `/admin/enfants/nouveau`. Ajouté au lot 10.
- [x] **Séances et appel** (`SessionsAdmin.jsx`) — ⚠️ **manquait aussi** :
      l'administration n'avait aucun moyen de consulter un appel ni d'en
      planifier un. Ajouté au lot 10.
- [x] `utils/childFileNumber.js` — miroir frontend du format
- [x] **Reprise du design des maquettes** (`design-page-enfant/`) :
      - `ChildrenChart/` — anneau de répartition et barres de progression,
        palette validée (voir ci-dessus), légende toujours présente portant
        valeur **et** pourcentage (elle tient lieu de vue tabulaire)
      - `ChildrenAvatar/` — pastille photo ou initiales, teinte dérivée du nom
        et stable d'un écran à l'autre, en verts et jaune désaturés
      - Cellules composées à deux niveaux, comme les maquettes : nom + qualité,
        date + repère relatif (« Aujourd'hui », « Demain », « samedi »),
        classe + salle
      - `utils/childrenDates.js` — le repère relatif n'est pas cosmétique : sur
        un écran de remplacements, ce qu'on cherche d'abord c'est ce qui se
        passe *aujourd'hui*
      - Tableau de bord : anneau de répartition + **présence du jour par
        classe**, avec `childStats.service.js` (4 agrégations groupées, aucun
        N+1 quel que soit le nombre de classes)
      - Une classe non encore appelée renvoie `null`, jamais `0` : afficher
        0 % un lundi matin serait un contresens
- [x] Fiche enfant détaillée à 5 onglets + écran Responsables + Historique

### Lot 7 — Espace moniteur ✅ TERMINÉ

- [x] Route `/monitorat` en `lazy`, sous `VITE_ENABLE_ADMIN` — chunk séparé
      de **11,7 ko** (3,6 ko compressé), jamais téléchargé par un visiteur
- [x] `services/monitor.js`
- [x] `services/auth.js` : gestion de `passwordChangeRequired` sur les DEUX
      chemins de connexion (avec et sans second facteur)
- [x] 5 écrans : aiguillage, connexion, changement de mot de passe forcé,
      accueil, **faire l'appel**
- [x] Ergonomie de l'appel : cibles de **56 px**, « Tous présents » en tête,
      **un seul envoi** en fin d'appel, `env(safe-area-inset-bottom)` pour la
      barre de validation, champs à 16 px (en dessous, iOS zoome au focus et
      décale l'écran sous les doigts)
- [x] Palette propre sous `.monitor-app` (l'espace vit hors de
      `.admin-shell`, où les jetons `--admin-*` ne sont pas définis), reprenant
      le vert du back office — clair et sombre

### Lot 8 — Fiche enfant, responsables, historique ✅ TERMINÉ

- [x] `ChildProfile.jsx` — fiche à **5 onglets**, chacun chargeant ses propres
      données : ni les documents ni l'historique n'arrivent avec la fiche
- [x] Onglet Documents : quota affiché, consultation par **lien signé demandé
      au clic** — jamais préchargé, sinon on tracerait une consultation qui
      n'a pas eu lieu
- [x] Onglet Présences : taux calculé sur **tout** l'historique, pas sur la
      page affichée ; le remplacement y apparaît (« en remplacement de Jean »)
- [x] Encadré « Dossier à compléter » : la fiche dit ce qui manque, plutôt que
      de laisser découvrir les vides au hasard
- [x] `GuardiansAdmin.jsx` — annuaire des responsables, avec le nombre
      d'enfants rattachés et le rapprochement par matricule
- [x] `HistoryAdmin.jsx` + route `/api/admin/enfants/historique` — journal
      **restreint côté serveur** aux ressources du module : le responsable de
      l'École du dimanche n'y voit ni les connexions, ni les dons, ni le
      Service Social
- [x] Tableau de bord : anneau de répartition + présence du jour
- [x] `Event.childClasses[]` en place (pas de second système d'événements)

### Lot 9 — Tests (Phase 4) ✅ TERMINÉ

86 tests neufs, en 6 fichiers : `substitutionWindow` (fenêtres et conflits),
`childFileNumber` (format et réparation O/0, I/1), `firstPassword.service`
(mot de passe temporaire, ordre 2FA), `upload.service` (dossiers par rôle,
URL signée **et** datée), `monitor.service` (accès aux classes),
`children.routes` (permissions, cloisonnement, **ordre de routage**).

**Ce que ces tests n'ont pas attrapé, et pourquoi** — voir le lot 10 : ils
vérifiaient des règles métier, jamais qu'une page se charge. Un module peut
être entièrement vert et entièrement inutilisable.

#### Reste à couvrir

- [ ] Enfants : création, modification, désactivation, recherche, classe,
      parent, document
- [ ] Moniteurs : attribution de fonction, création d'accès, connexion
      matricule, mot de passe temporaire, première connexion, désactivation
- [ ] Remplacements : les 3 modes, accès temporaire, **expiration**, refus
      après expiration, audit
- [ ] Présences : présent / absent / excusé, tous présents, correction,
      historique, présence en classe remplacée
- [ ] Permissions : un moniteur ne voit ni les autres classes ni les données
      interdites
- [ ] Sécurité : API sans authentification, mauvais rôle, classe interdite,
      classe après expiration, document interdit, envoi invalide

---

## Lot 10 — Défauts découverts APRÈS la mise en production 🔧

Le module a été déployé le 1ᵉʳ septembre avec 412 tests au vert. Il était
**inutilisable**. Cette section existe pour que la raison ne se perde pas.

### 10.1 — Les sous-chemins pris pour des identifiants ✅ corrigé (`77dbf69`)

`router.get("/:id")` était déclaré AVANT les montages `/classes`,
`/moniteurs`, `/remplacements`, `/responsables`, `/seances` et
`/historique`. Express résout dans l'ordre de déclaration : chaque chemin
littéral partait donc en identifiant d'enfant, `Child.findById("remplacements")`
levait un `CastError`, rendu au navigateur en **« Identifiant invalide. »**.

Toutes les pages du module étaient touchées, pas seulement les remplacements.

- [x] Le bloc `/:id` passe après tous les chemins littéraux
- [x] Garde `router.param("id")` : un identifiant non conforme répond
      **404 « Enfant introuvable »** au lieu d'un 400 illisible. Nécessaire
      en plus du réordonnancement — `/seances` n'exposait qu'un POST, donc un
      GET traversait le montage sans handler et repartait vers `/:id`
- [x] 8 tests qui appellent chaque chemin littéral. **Le test qui verrouille
      réellement l'ordre est celui qui exige un 200 sur les listes** : la
      garde seule ferait passer un simple contrôle du message

### 10.2 — Deux écrans annoncés mais jamais construits ✅ corrigé

Le tableau de bord et la liste pointaient tous deux vers
`/admin/enfants/nouveau`, une route qui n'existait pas. React Router la
faisait tomber sur `enfants/:id`, la fiche s'ouvrait avec
`id = "nouveau"` — et affichait « Enfant introuvable ».

- [x] `ChildForm.jsx` — création d'un enfant. Erreurs affichées **sous le
      champ concerné** (`details` de l'API), champs vides non envoyés plutôt
      qu'enregistrés à blanc, date bornée à aujourd'hui côté navigateur
- [x] Route `enfants/nouveau` déclarée **avant** `enfants/:id` — le même
      piège qu'en 10.1, côté React Router cette fois
- [x] `SessionsAdmin.jsx` — séances et appel côté administration : filtres
      classe/période, planification, consultation d'une feuille d'appel
- [x] `GET /api/admin/enfants/seances` + `listSessions()` — n'existaient pas.
      Compteurs obtenus par **une** agrégation groupée sur toute la page
- [x] Un enfant sans ligne d'appel s'affiche « Non pointé », **jamais
      « absent »** : personne ne s'est prononcé sur lui
- [x] Taux moyen calculé sur les seules séances réellement appelées

### 10.3 — Ce que cet épisode apprend

**Les tests vérifiaient des règles, pas des écrans.** 86 tests couvraient les
permissions, l'expiration des remplacements, le cloisonnement des classes —
et pas un seul n'ouvrait une page. Un module peut être entièrement vert et
entièrement inutilisable.

**Un fichier de suivi qui n'est pas relu ne sert à rien.** Le lot 6 était
coché « terminé, 5 écrans » ; il en manquait deux, dont un vers lequel deux
boutons pointaient déjà.

- [x] `routeLinks.test.js` — aucun lien écrit en dur ne pointe vers une route
      absente. ⚠️ **La première version de ce test était creuse** : elle
      laissait un segment `:param` absorber n'importe quoi, si bien que
      `/admin/enfants/nouveau` était « trouvé » par `enfants/:id` — le
      mécanisme même du bug. Corrigée : un lien statique doit correspondre à
      une route **littérale**. Vérifié en insérant un lien mort, qui fait bien
      échouer le test.
- [x] `Children.smoke.test.jsx` — les 10 écrans du module montés deux fois
      chacun, avec et **sans aucune donnée** (le cas d'une église qui démarre,
      là où un `items[0]` non gardé casse). Vérifié en retirant une fonction
      du mock : le test échoue bien.
- [ ] Reste ouvert : ces deux tests n'auraient PAS attrapé les pannes 10.1 et
      10.2, toutes deux dues à l'**ordre** des routes. `routeLinks` couvre
      désormais le second cas ; le premier (ordre côté Express) est couvert
      par `children.routes.test.js`. Aucun test ne vérifie encore l'ordre
      **côté React Router** — un chemin littéral déclaré après `:id` passerait
      les trois.

---

## Règles de travail propres à ce chantier

Rappels tirés de l'audit, à ne pas perdre de vue à chaque lot :

1. **SCSS.** Une seule feuille pour tout le site. Tout imbriqué sous la classe
   racine du composant, aucun nom générique (`.card`, `.badge`, `.roll`,
   `.class-name`…). Vérification par `grep` sur `dist/assets/*.css` après
   chaque écran. Ce piège a déjà causé quatre régressions, chaque fois sur une
   *autre* page.
2. **Tests.** Base de développement partagée, fichiers exécutés en parallèle.
   Nettoyage sur marqueur propre à la suite, jamais `deleteMany({ church })`.
   Ne jamais interrompre `npm test` en cours (les hooks `after()` ne passent
   pas et laissent des résidus).
3. **Églises de test.** Les 4 bacs à sable (2–5) sont déjà répartis pour
   `SocialFundSettings`. Ce module ne crée **aucune ressource unique par
   église** — les classes sont uniques par `{church, name}`, donc partageables.
4. **Le module ne crée jamais de `Member`.** Un `Member` créé déclencherait
   `syncMemberContributionsQuietly` et générerait de vraies offrandes sociales.
5. **Tri dans Mongo, jamais dans le navigateur.** Les listes sont paginées ;
   retrier une page ne réordonne qu'elle. Même raison que pour les matricules
   de l'annuaire.
6. **Audit silencieux.** `audit.service.js` avale ses erreurs. Une valeur
   d'enum oubliée supprime la trace sans aucun signal — d'où le test dédié qui
   écrit puis relit chacune des six nouvelles actions.

---

## Journal

### 1ᵉʳ septembre 2026 — Mise en production, et deux corrections

- Les 22 commits en attente poussés sur `origin/main` (dont 17 antérieurs au
  chantier, jamais publiés). Render redéploie automatiquement.
- **Première panne** : toutes les pages du module renvoyaient
  « Identifiant invalide ». Cause : ordre de déclaration des routes
  (lot 10.1). Corrigé et republié le jour même.
- **Seconde panne** : le bouton « Nouvel enfant » renvoyait
  « Enfant introuvable ». Cause : l'écran n'existait pas (lot 10.2).
- Écran « Séances et appel » construit dans la foulée — l'administration
  n'avait aucun moyen de consulter un appel.
- Ce fichier de suivi remis en accord avec la réalité : il déclarait
  « terminé » un lot qui ne l'était pas.
- Consigne reçue : **suivre ce fichier désormais**. Les deux tâches ouvertes
  du lot 10.3 traitées dans la foulée (test des liens, test de fumée),
  chacune vérifiée capable d'échouer avant d'être cochée.


### 27 août 2026 — Phases 1 et 2

- Audit complet du backend (modèles, services, middlewares, routes, jobs,
  configuration) et du frontend (routes, gardes, layout admin, services HTTP,
  espace de badgeage).
- Diagnostic rédigé : sections A à T, 5 décisions structurantes, 4 questions
  ouvertes, 10 risques techniques identifiés.
- **Arrêt volontaire.** Aucun fichier de code créé ni modifié, conformément à
  la consigne d'arrêt après Phase 2.
