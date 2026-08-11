# Service Social — Phase 1 (cotisations, dashboard, caisse en lecture)

Date : 2026-08-11
Statut : approuvé par l'utilisateur, prêt pour le plan d'implémentation.

## Contexte

Le CAVA gère un fonds de solidarité (« Service Social ») alimenté par une cotisation
mensuelle obligatoire par membre, destiné à financer des aides sociales (décès,
naissance, maladie, etc.). Ce document couvre uniquement la **Phase 1** : le
dashboard, le suivi des cotisations et une caisse en lecture seule (entrées de
cotisations uniquement). Les aides sociales, le workflow de validation/décaissement,
les rapports PDF/graphiques et les clôtures sont des phases ultérieures, hors
périmètre de ce document.

Le module s'intègre au dashboard admin **existant** (`src/pages/Admin/`,
`backend/src/`) : aucune nouvelle authentification, aucun nouveau layout, aucun
nouveau système de permissions générique — uniquement de nouveaux rôles, de
nouvelles routes et de nouvelles pages suivant les patterns déjà en place
(cf. `DonationsAdmin.jsx` comme référence directe).

## Décisions de cadrage (validées avec l'utilisateur)

1. **Rôles** : les 4 rôles du cahier des charges (`social_admin`, `social_agent`,
   `social_approver`, `social_viewer`) sont ajoutés à l'enum `role` existant sur
   `User` — pas de champ multi-rôle séparé. `social_approver` est ajouté dès
   maintenant (pour éviter une seconde migration d'enum en Phase 2) mais n'a
   aucun usage concret en Phase 1.
2. **Caisse** : une caisse **distincte par église** (`church` 1 à 5), pas une caisse
   globale unique. Actuellement une seule église est active en pratique, mais le
   modèle de données est pensé pour les 5 dès maintenant.
3. **Dashboard** : vue **globale agrégée par défaut**, avec un sélecteur d'église
   pour filtrer sur une église précise.
4. **Montant de cotisation** : **configurable par église** (`SocialFundSettings`
   par église), pas une valeur globale unique.
5. **Scoping des agents** : pas de rattachement `User` ↔ église en Phase 1 (une
   seule église active actuellement). Tout utilisateur avec un rôle `social_*` voit
   les églises existantes ; le rattachement d'un agent à une église précise est
   différé à une phase où plusieurs églises seront réellement actives.
6. **Génération des lignes mensuelles** : **tâche planifiée quotidienne**
   (`setInterval` 24h, pattern identique à `backend/src/jobs/followUpReminders.js`),
   pas de génération à la demande. Chaque jour, pour chaque église ayant des
   `SocialFundSettings`, crée les lignes `SocialContribution` manquantes du mois
   courant pour les membres actifs de cette église, au montant en vigueur à cet
   instant. Idempotent par construction.

## Modèle de données (MongoDB / Mongoose)

### `SocialFundSettings` (nouveau modèle, `backend/src/models/SocialFundSettings.js`)

| Champ | Type | Notes |
|---|---|---|
| `church` | Number (1-5) | unique, index |
| `monthlyContributionAmount` | Number | défaut 1000, min 0 |
| `openingBalance` | Number | défaut 0, solde initial de caisse à l'activation du module pour cette église |
| `updatedBy` | ObjectId ref `User` | |
| `createdAt`/`updatedAt` | timestamps | |

Un enregistrement par église existante ; créé à la demande (première configuration)
plutôt que pré-seedé pour les 5 églises. Une église sans `SocialFundSettings` n'a pas
de module Service Social actif (pas de génération de cotisations, absente des KPIs).

### `SocialContribution` (nouveau modèle, `backend/src/models/SocialContribution.js`)

Une ligne = un membre × un mois × une année.

| Champ | Type | Notes |
|---|---|---|
| `member` | ObjectId ref `Member` | required |
| `church` | Number (1-5) | dénormalisé depuis `member.church` au moment de la génération |
| `flock` | ObjectId ref `Flock` | dénormalisé depuis `member.flock`, pour filtres tableau |
| `year` | Number | required |
| `month` | Number (1-12) | required |
| `amountDue` | Number | figé au montant `SocialFundSettings` en vigueur au moment de la génération de la ligne |
| `amountPaid` | Number | défaut 0 |
| `status` | enum `non_paye \| paye \| partiel \| exonere \| annule` | défaut `non_paye` |
| `reference` | String, unique, sparse | assignée uniquement au moment du paiement, format `SOC-YYYYMMDD-NNNNNN` |
| `paidAt` | Date | horodatage serveur, jamais l'heure du navigateur |
| `recordedBy` | ObjectId ref `User` | agent ayant enregistré le paiement |
| `exemption` | `{ motif: String, by: ObjectId ref User, at: Date }` | présent seulement si `status === 'exonere'` |
| `cancelledAt` / `cancelledBy` / `cancelReason` | | présent seulement si `status === 'annule'` — une correction annule la ligne existante et une nouvelle ligne est créée pour le bon mois, jamais de suppression physique (section 27 du cahier des charges) |
| timestamps | | |

Index unique composé `{ member: 1, year: 1, month: 1 }` — empêche toute ligne en
double pour un même membre/mois (le job de génération s'appuie dessus pour être
idempotent : `insertMany` avec `ordered:false` et ignore des erreurs de clé dupliquée,
ou vérification préalable des couples déjà existants).

« En retard » n'est **pas** un statut stocké : c'est une valeur dérivée au moment de
la requête (`status` dans `[non_paye, partiel]` ET `(year, month)` strictement
antérieur au mois courant). Cela évite un état à resynchroniser à chaque changement
de mois.

### `SocialLedgerEntry` (nouveau modèle, `backend/src/models/SocialLedgerEntry.js`)

Mouvement de caisse, écrit automatiquement par le service métier (jamais saisi
manuellement en Phase 1).

| Champ | Type | Notes |
|---|---|---|
| `church` | Number (1-5) | |
| `type` | enum `cotisation` | enum extensible en Phase 2 (`aide`, etc.) |
| `reference` | String | référence de l'opération source (ex. la `reference` de la `SocialContribution`) |
| `description` | String | ex. « Cotisation — Jean KOUASSI — Août 2026 » |
| `amount` | Number | toujours positif en Phase 1 (aucune sortie) ; signé en Phase 2 |
| `recordedBy` | ObjectId ref `User` | |
| timestamps | | |

Le solde de caisse d'une église à un instant T = `SocialFundSettings.openingBalance`
+ somme des `SocialLedgerEntry.amount` de cette église. Calculé **côté backend** via
agrégation Mongo à chaque lecture — jamais mis en cache côté frontend comme source de
vérité (section 20 du cahier des charges).

### Compteur de référence (`backend/src/models/SocialCounter.js`)

Compteur atomique global (indépendant par nature de la référence donation
`CAVA-xxxxxxxx` qui est aléatoire) : un seul document, `{ _id: 'social', seq: Number }`,
incrémenté via `findOneAndUpdate({}, { $inc: { seq: 1 } }, { upsert: true, new: true })`.
La référence finale est `SOC-${YYYYMMDD du jour}-${seq paddé à 6 chiffres}` — le
compteur ne se réinitialise pas chaque jour (simplicité, garantie d'unicité triviale),
seul le préfixe de date change visuellement.

## Rôles & permissions

`backend/src/models/User.js` — extension de l'enum :

```js
role: {
  enum: [
    "admin", "editor", "soa", "cana", "coordinateur_bergeries", "pasteur",
    "social_admin", "social_agent", "social_approver", "social_viewer",
  ],
}
```

Matrice de droits Phase 1 :

| Action | social_admin | social_agent | social_viewer | social_approver |
|---|---|---|---|---|
| Voir dashboard/listes/caisse | ✓ | ✓ | ✓ | ✓ (inutilisé en pratique Phase 1) |
| Enregistrer une cotisation | ✓ | ✓ | ✗ | ✗ |
| Exonérer une ligne | ✓ | ✗ | ✗ | ✗ |
| Configurer montant/solde initial par église | ✓ | ✗ | ✗ | ✗ |

`admin` (rôle global existant) garde un accès complet à tout le dashboard, y compris
ce module, par cohérence avec le reste de l'admin (aucune route ne doit exclure
`admin`).

Frontend : `src/routes/roleGroups.js` gagne `SOCIAL_ROLES = ["social_admin",
"social_agent", "social_approver", "social_viewer", "admin"]`, et un sous-groupe
`SOCIAL_WRITE_ROLES = ["social_admin", "social_agent", "admin"]` pour les actions
d'écriture. Nouvelle entrée de navigation « SERVICE SOCIAL » dans `AdminLayout.jsx`
(`NAV_GROUPS`), filtrée par `SOCIAL_ROLES`.

## Job planifié

`backend/src/jobs/socialContributionsGenerator.js`, calqué sur
`followUpReminders.js` :

```js
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const runSweep = async () => {
  try {
    const created = await socialContribution.service.generateDueContributionsForCurrentMonth();
    if (created > 0) console.log(`[socialContributionsGenerator] ${created} ligne(s) générée(s).`);
  } catch (error) {
    console.error("[socialContributionsGenerator] balayage impossible :", error.message);
  }
};
export const scheduleSocialContributionsGenerator = () => {
  runSweep();
  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref();
};
```

Appelé une seule fois au démarrage dans `backend/src/server.js`, jamais dans les
tests. La logique réelle vit dans
`socialContribution.service.js#generateDueContributionsForCurrentMonth()` : pour
chaque `SocialFundSettings`, pour chaque `Member` actif de cette église sans ligne
`SocialContribution` pour `(year, month)` courants, crée la ligne `non_paye`.

Un script one-off `backend/src/scripts/backfillSocialContributions.js` (idempotent,
même esprit que `seed.js`) permet d'amorcer manuellement le mois courant après
déploiement sans attendre le premier passage du job.

## API (`backend/src/routes/social.routes.js`, monté sur `/api/admin/social`)

Routes sur-mesure (pas via `resourceRouter` générique — logique métier trop
spécifique : montants figés, génération de référence, calcul de solde, transaction
multi-mois). Toutes authentifiées (`requireAuth`), rôles précisés entre parenthèses.

| Méthode & chemin | Rôles | Description |
|---|---|---|
| `GET /dashboard?church=` | tout rôle social | 8 KPIs ; agrégé toutes églises si `church` omis |
| `GET /settings` | tout rôle social | liste des `SocialFundSettings` existants |
| `PATCH /settings/:church` | `social_admin` | crée/modifie montant + solde initial d'une église |
| `GET /members/search?q=` | tout rôle social | recherche par matricule/nom/prénom/téléphone, membres actifs uniquement |
| `GET /members/:memberId/fiche` | tout rôle social | historique mensuel complet + totaux |
| `POST /contributions` | `social_admin`, `social_agent` | `{ memberId, payments: [{ year, month, amount }] }` — transaction Mongo (session), crée/complète 1..n lignes, génère les références, écrit les `SocialLedgerEntry` correspondantes |
| `GET /contributions?church=&year=&month=&status=&search=&page=` | tout rôle social | liste paginée, filtrable |
| `GET /contributions/impayes?church=` | tout rôle social | agrégation par membre (mois dus, total dû) |
| `PATCH /contributions/:id/exonerer` | `social_admin` | `{ motif }`, motif obligatoire |
| `GET /contributions/:id/recu` | tout rôle social | PDF (authentifié — contrairement au reçu de don qui est public par référence, celui-ci reste dans le dashboard) |
| `GET /caisse?church=` | tout rôle social | solde initial / total cotisations / solde actuel, recalculé serveur |
| `GET /caisse/mouvements?church=&page=` | tout rôle social | liste paginée des `SocialLedgerEntry` |

Toutes les écritures (`POST /contributions`, `PATCH .../exonerer`, `PATCH
/settings/:church`) journalisent dans `AuditLog` via `audit.record(req, { action,
resource: "socialContribution" | "socialFundSettings", resourceId })`, en réutilisant
le service `audit.service.js` existant (pas de nouveau modèle d'audit).

## Frontend

Nouvelles pages, `src/pages/Admin/Social/` :

- `SocialDashboard.jsx` — 8 cartes KPI + sélecteur d'église
- `SocialContributionsAdmin.jsx` — liste du mois courant, filtres statut, totaux (attendu/collecté/reste/taux)
- `SocialNewContribution.jsx` — recherche membre → sélection mois/montant (1 ou plusieurs) → confirmation → reçu
- `SocialUnpaidAdmin.jsx` — liste des impayés par membre (mois dus, total dû)
- `SocialMemberSearch.jsx` — recherche + fiche sociale (historique mensuel, totaux)
- `SocialCaisse.jsx` — solde par église + mouvements paginés

Toutes suivent le pattern déjà établi par `DonationsAdmin.jsx` : `usePageMeta`,
`useAsyncData` pour le chargement, `AdminLoading`/`AdminError`/`AdminEmpty` pour les
états, tableau HTML natif avec badges de statut par dictionnaire, `AdminModal` pour
les actions ponctuelles (exonération, confirmation de paiement).

`src/services/social.js` — miroir de `src/services/donations.js`, un wrapper par
endpoint ci-dessus, basé sur `request`/`requestWithMeta` de `src/services/http.js`.

Routes ajoutées dans `src/routes/AdminRoutes.jsx` sous `/admin/social/...` :
`/admin/social` (dashboard), `/admin/social/cotisations`,
`/admin/social/cotisations/nouvelle`, `/admin/social/cotisations/impayes`,
`/admin/social/membres`, `/admin/social/caisse` — chacune enveloppée dans
`<RequireRole allow={SOCIAL_ROLES}>` (ou `SOCIAL_WRITE_ROLES` pour la page de
nouvelle cotisation).

### Reçu & WhatsApp

Bouton « Télécharger le reçu » → lien direct vers `GET
/api/admin/social/contributions/:id/recu` (comme le module Dons). Bouton
« WhatsApp » → construit le message texte (modèle de la section 11 du cahier des
charges) et ouvre `https://wa.me/?text=<encodé>` dans un nouvel onglet — **pas**
d'envoi automatique du PDF, conformément à la contrainte explicite (aucune
intégration WhatsApp Business API en Phase 1).

Génération PDF côté backend avec **`pdfkit`** + **`qrcode`**, réutilisation directe
du pattern de `backend/src/services/receipt.service.js` (bandeau vert CAVA, montant
en chiffres, QR de référence, pied de page).

## Erreurs & cas limites à couvrir

- Paiement d'un mois déjà `paye` → rejeté (409), pas de double comptage.
- Paiement partiel : `amount < amountDue` → `status: 'partiel'`, `amountPaid` cumulé si plusieurs paiements partiels successifs sur le même mois.
- Paiement multi-mois où un des mois est déjà payé → la transaction ne doit valider que les mois valides et signaler clairement lequel a été refusé (pas d'échec silencieux total ni de validation partielle non signalée).
- Exonération d'un mois déjà payé → interdit (l'exonération ne s'applique qu'à `non_paye`/`partiel`).
- Église sans `SocialFundSettings` → absente du sélecteur dashboard, aucune génération de cotisation, message explicite plutôt qu'une caisse à zéro trompeuse.
- Membre passant à `status: 'inactif'` en cours de mois → le job ne génère plus de nouvelles lignes pour lui, mais l'historique existant reste consultable.
- Écritures concurrentes (deux agents enregistrent le même membre/mois simultanément) → protégé par l'index unique `{member, year, month}` côté `SocialContribution` ; la seconde écriture échoue proprement (409) plutôt que de créer un doublon.

## Tests

Suivant la convention backend (`node --test`, base partagée avec le dev — voir
CLAUDE.md, nettoyage scrupuleux obligatoire) : tests d'intégration sur le service
`socialContribution.service.js` (génération idempotente, paiement mono/multi-mois,
exonération, calcul de solde), et sur les routes (permissions par rôle, rejet des
doubles paiements). Frontend : tests Vitest ciblés si de la logique pure émerge
(ex. formatage de statut, calcul de totaux affichés) — pas de test de rendu profond
imposé, en cohérence avec la pratique actuelle du projet.

## Hors périmètre (rappel)

Aides sociales, workflow de validation/décaissement, sorties de caisse, clôtures de
caisse, rapports mensuels PDF, graphiques 12 mois, relances automatiques sur
impayés, page « Journal d'activité » dédiée (on s'appuie sur `AuditLog` existant en
interne sans nouvelle UI). Ces éléments feront l'objet de specs séparées.
