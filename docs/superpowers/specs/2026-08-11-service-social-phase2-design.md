# Service Social — Phase 2 (aides sociales, décaissements)

Date : 2026-08-11
Statut : approuvé par l'utilisateur, prêt pour implémentation.

## Contexte

Suite de [2026-08-11-service-social-phase1-design.md](2026-08-11-service-social-phase1-design.md)
(cotisations, dashboard, caisse en lecture — déjà en production). Cette phase
ajoute la seconde moitié du module : les **aides sociales** (décaissements de la
caisse), avec un workflow de validation séparé de l'enregistrement.

## Décisions de cadrage

1. **Workflow simplifié à 2 étapes** (au lieu des 4 du cahier des charges) :
   création (`SOCIAL_AGENT`/`SOCIAL_ADMIN`) → validation = paiement immédiat
   (`SOCIAL_APPROVER`/`SOCIAL_ADMIN`), en une seule action. Le décaissement a
   lieu au moment de la validation, pas dans une étape séparée. Statuts
   retenus : `en_attente | payee | refusee | annulee` (4, pas 5 — « validée »
   et « payée » sont fusionnées).
2. **Blocage si solde insuffisant** : une validation est refusée (409) si le
   montant dépasse le solde actuel de la caisse de l'église du bénéficiaire,
   recalculé côté backend au moment de la décision (jamais depuis une valeur
   transmise par le client).
3. **Séparation créateur/validateur non bloquée en dur** : un compte `admin`
   peut aujourd'hui créer et valider la même demande (un seul opérateur gère
   tout le module en pratique actuellement). L'audit note explicitement les
   cas où `requestedBy === decidedBy`, pour rester visible si l'équipe
   grandit, plutôt que de verrouiller un scénario qui bloquerait l'unique
   utilisateur actuel.
4. **Annulation d'une aide payée** : réservée `SOCIAL_ADMIN`. Ne supprime rien
   ni ne modifie l'écriture de caisse d'origine — crée une **écriture de
   compensation** (`SocialLedgerEntry` positive, référence liée) qui restaure
   le solde, conformément à la règle « jamais de suppression d'une opération
   financière validée » (section 27 du cahier des charges).
5. **Types d'aide** : ressource CRUD configurable (`SocialAidType`), pas un
   enum figé — mêmes 7 catégories par défaut que le cahier des charges
   (Décès, Naissance, Maladie, Aide sociale, Urgence, Exceptionnelle, Autre),
   gérée comme `DonationType` (`active`, `order`).

## Modèle de données

### `SocialAidType` (nouveau, `backend/src/models/SocialAidType.js`)

Calqué sur `DonationType.js` : `name` (String, required, maxlength 60),
`description` (String, maxlength 240), `active` (Boolean, défaut `true`),
`order` (Number, défaut 0), `createdBy` (ObjectId ref User), timestamps.

### `SocialAid` (nouveau, `backend/src/models/SocialAid.js`)

| Champ | Type | Notes |
|---|---|---|
| `reference` | String, unique | `AIDE-YYYY-NNNNN` (année + compteur 5 chiffres) |
| `member` | ObjectId ref Member | bénéficiaire, required |
| `church` | Number (1-5) | dénormalisé depuis `member.church` |
| `aidType` | `{ ref: ObjectId ref SocialAidType, name: String }` | nom figé au moment de la demande, même pattern que `Donation.donationType` |
| `amount` | Number, required, min 0 | |
| `motif` | String, maxlength 200, required | |
| `description` | String, maxlength 1000 | optionnel |
| `proofUrl` | String | optionnel, pièce justificative Cloudinary |
| `status` | enum `en_attente\|payee\|refusee\|annulee` | défaut `en_attente` |
| `requestedBy` | ObjectId ref User | |
| `decidedBy` / `decidedAt` / `decisionNote` | | posés à la validation/refus ; `decisionNote` obligatoire si `refusee` |
| `paidAt` | Date | posé en même temps que `decidedAt` si `payee` |
| `cancelledAt` / `cancelledBy` / `cancelReason` | | si `annulee` |
| timestamps | | |

### `SocialLedgerEntry` (existant, Phase 1) — extension

`type` gagne la valeur `"aide"` (en plus de `"cotisation"`). `amount` devient
**signé** : positif pour une cotisation ou une compensation d'annulation,
négatif pour un décaissement d'aide. Le calcul de solde (`openingBalance +
somme(amount)`) reste inchangé — c'est déjà une simple somme signée.

## API (`backend/src/routes/social.routes.js`, extension)

Types d'aide (CRUD géré à la main dans `social.routes.js`, **pas** via
`resourceRouter` générique — celui-ci réserve la suppression au rôle littéral
`admin`, ce qui exclurait `social_admin` ; incohérent avec le reste du
module) :

- `GET /aid-types` — `SOCIAL_READ_ROLES`
- `POST /aid-types`, `PATCH /aid-types/:id`, `DELETE /aid-types/:id` — `SOCIAL_ADMIN_ROLES`

Aides sociales :

- `GET /aids?church=&status=&search=&page=&limit=` — `SOCIAL_READ_ROLES`
- `GET /aids/:id` — `SOCIAL_READ_ROLES`
- `POST /aids` `{memberId, aidTypeId, amount, motif, description?, proofUrl?}` — `SOCIAL_WRITE_ROLES`
- `PATCH /aids/:id/valider` — `SOCIAL_ADMIN_ROLES` ∪ rôle `social_approver` (donc `["admin","social_admin","social_approver"]`) — décaisse et journalise
- `PATCH /aids/:id/refuser` `{motif}` — mêmes rôles que valider, motif obligatoire
- `PATCH /aids/:id/annuler` `{motif}` — `SOCIAL_ADMIN_ROLES` uniquement, seulement si `status === 'payee'`

Upload de la pièce justificative : réutilise l'endpoint générique existant
`POST /api/admin/uploads/signature` (déjà authentifié) avec `folder:
"socialAids"` — ajouter cette clé à l'allowlist `FOLDERS` de
`backend/src/services/upload.service.js` (`socialAids: "cava/social-aids"`).
Pas de nouvelle route d'upload dédiée.

`dashboard()` et `caisse()`/`ledgerMovements()` (Phase 1, déjà en place) sont
mis à jour pour calculer `aidAmountThisMonth`/`aidCount` depuis `SocialAid`
(`status: 'payee'`, `paidAt` dans le mois courant) au lieu des `0` figés.

## Frontend

- `src/pages/admin/Social/SocialAidsAdmin.jsx` (+ `.scss`) — même pattern que
  `SocialContributionsAdmin.jsx` : liste filtrable par statut, recherche
  membre + formulaire de nouvelle demande (modale), actions Valider/Refuser/
  Annuler selon rôle et statut.
- `src/pages/admin/Social/SocialAidTypesAdmin.jsx` — `AdminCrud` existant,
  calqué sur `DonationTypesAdmin.jsx`.
- `SocialDashboard.jsx` : les cartes « Aides sociales du mois » / « Nombre
  d'aides » perdent leur mention « Phase 2 » et affichent les vraies valeurs.
- `SocialCaisse.jsx` : le tableau des mouvements distingue visuellement
  entrée (vert, `+`) et sortie (rouge, `-`) selon le signe de `amount`, au
  lieu de toujours afficher `+`.
- Nouvelle entrée de nav « Aides sociales » (et éventuellement « Types
  d'aide », réservée admin) dans le groupe « Service Social » existant.

## Hors périmètre (rappel)

Rapports mensuels PDF + graphiques, clôtures de caisse, relances automatiques.
