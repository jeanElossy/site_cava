# Système d'inscription des membres avec matricule — Design

Date : 2026-07-29
Statut : validé par l'utilisateur, en attente de plan d'implémentation.

## Contexte

Le CAVA tient depuis plusieurs années un registre papier des membres, chacun identifié par un matricule au format observé sur 44 lignes réelles (ex. `1OL 16-005 E`, `1SH 17-006 F`, `1RA 20-020 T`). Le backend Express/MongoDB du projet possède déjà un modèle `Member` ([backend/src/models/Member.js](../../../backend/src/models/Member.js)) et un écran d'administration ([src/pages/admin/CommunityAdmin.jsx](../../../src/pages/admin/CommunityAdmin.jsx)) pour la saisie manuelle, mais sans notion de matricule ni d'auto-inscription publique.

L'objectif : permettre à un membre de s'inscrire lui-même (nouveau, ou déjà porteur d'un matricule papier), tout en générant automatiquement des matricules conformes au format existant, avec téléchargement de la liste complète pour l'administration.

## Format du matricule

Forme canonique stockée (sans espace, majuscules) : `1OL25045S`, 9 caractères.
Forme affichée : `1OL 25-045 S`.

```
   1        OL        25        045        S
   │        │         │          │          │
 église   bergerie   année    n° dans    lettre
 (1-5)   (2 lettres) (2 ch.)  l'église   de contrôle
                               (3 ch.)
```

- **Église** (1 chiffre) : liste fixe des 5 églises du réseau, codée en dur côté backend et frontend (même pattern que `MEMBER_ROLES` dans `CommunityAdmin.jsx`) — une structure qui ne change quasiment jamais n'a pas besoin d'un CRUD.
- **Bergerie** (2 lettres) : format confirmé par les 44 matricules réels (`PS`, `MP`, `EL`, `ME`, `OL`, `SH`, `RO`, `CH`, `RA`, `TS`, `NI`, `JI`, …). Gérée comme une ressource de contenu CRUD (nouvelle collection `Bergerie`), au même pattern que `Ministry`, car de nouvelles bergeries se créent au fil du temps.
- **Année** (2 chiffres) : année civile d'arrivée du membre.
- **Numéro** (3 chiffres, `001`–`999`) : rang d'inscription **dans l'église**, incrémenté à chaque validation d'inscription. Ne se remet jamais à zéro (ni par bergerie, ni par année) — confirmé par l'observation des 44 matricules réels, où le compteur traverse plusieurs bergeries et années sans jamais repartir de `001`.
- **Lettre de contrôle** (1 lettre) : jamais saisie, toujours dérivée du numéro par `lettre = ALPHABET[(numéro - 1) % 26]`. Sert à détecter une erreur de recopie (constaté sur la ligne 044 du registre existant : `1ME 23-043 R` porte un numéro dupliqué avec la ligne 043, la lettre `R` étant elle correcte pour le rang 44).

### Anomalies relevées dans le registre existant

Deux corrections à faire lors de l'import initial (hors périmètre de cette spec, à traiter manuellement ou via un script ponctuel) :

| Ligne | Valeur actuelle | Valeur correcte |
|---|---|---|
| 015 — LIADE Jocelyne | `JI 19-015 O` | `1JI 19-015 O` (chiffre d'église manquant) |
| 044 — WAYOU Laura | `1ME 23-043 R` | `1ME 23-044 R` (numéro dupliqué avec la ligne 043) |

### Génération et concurrence

Un compteur atomique par église, dans une nouvelle collection `MatriculeCounter` :

```
{ eglise: 1, dernierNumero: 44 }
```

Incrémenté via `findOneAndUpdate` + `$inc` pour que deux validations simultanées par deux administrateurs ne produisent jamais deux fois le même numéro.

### Plafond

3 chiffres plafonnent à 999 membres par église. À 950/999, un bandeau d'alerte apparaît dans le tableau de bord admin (`/api/admin/stats`). À 999 atteint, la validation de toute nouvelle inscription pour cette église est refusée avec un message explicite ; l'extension à 4 chiffres est un changement de format qui sort du périmètre de cette spec.

## Modèle de données

### `Member` (existant, étendu)

Champs ajoutés au schéma actuel ([backend/src/models/Member.js](../../../backend/src/models/Member.js)) :

- `matricule` : String, unique, sparse (les tout premiers imports du registre papier peuvent temporairement ne pas en avoir un si non renseigné).
- `eglise` : Number (1-5).
- `bergerie` : ObjectId, référence `Bergerie`.
- État civil : `dateNaissance`, `sexe` (enum `homme`/`femme`), `situationMatrimoniale`, `nombreEnfants`.
- Vie spirituelle : `anneeConversion`, `bapteme.eau` (bool + année), `bapteme.saintEsprit` (bool), `egliseAnterieure`.
- Engagement : `profession`, `competences` (tableau de chaînes), `departementSouhaite`, `disponibilites`.
- Contact étendu : `whatsapp`, `commune`, `adresse`, `contactUrgence` (nom + téléphone), `photo` (URL Cloudinary).

Tous ces champs sont optionnels au niveau du schéma (`required: false`) — c'est le formulaire d'inscription public qui impose ses propres règles de complétude par étape, pas le modèle. Cela évite de bloquer la saisie manuelle existante en administration, qui ne remplira pas nécessairement chaque champ.

### `Bergerie` (nouveau)

```
{ code: String (2 lettres, unique par église), nom: String, eglise: Number, status }
```

Exposée en CRUD via le même `resourceRouter`/`createCrudService` que les autres ressources de contenu, écriture réservée à `admin` (comme `members`).

### `MatriculeCounter` (nouveau, interne)

```
{ eglise: Number (unique), dernierNumero: Number }
```

Jamais exposée directement par une route CRUD — seule la logique de validation d'inscription l'incrémente.

### `MemberSubmission` (nouveau)

Représente une soumission publique en attente de traitement par un administrateur :

```
{
  type: "nouveau" | "maj",
  matriculeSaisi: String | null,       // rempli seulement si type = "maj"
  memberExistant: ObjectId | null,     // rempli si matriculeSaisi correspond à un Member connu
  donnees: { ...tous les champs du formulaire ... },
  statut: "en_attente" | "valide" | "rejete",
  motifRejet: String | null,
  traitePar: ObjectId (ref User) | null,
  traiteLe: Date | null,
}
```

## Parcours publics

Nouvelle page publique `/inscription`, avec deux entrées :

### « Je suis nouveau »

Formulaire en plusieurs étapes (assistant/wizard avec barre de progression, pas une page unique) :

1. Identité (prénom, nom, église, bergerie)
2. Contact (téléphone, WhatsApp, e-mail, commune, adresse, photo)
3. État civil (date de naissance, sexe, situation matrimoniale, nombre d'enfants)
4. Vie spirituelle (année de conversion, baptêmes, église antérieure)
5. Engagement (profession, compétences, département souhaité, disponibilités)
6. Récapitulatif et envoi

Chaque étape se valide avant de passer à la suivante. Champs obligatoires minimaux : prénom, nom, église, bergerie, téléphone — le reste est facultatif pour ne pas décourager l'abandon en cours de route.

### « J'ai déjà un matricule »

Un champ de saisie unique, avec normalisation automatique de la saisie (accepte `1OL 16-005 E`, `1ol16005e`, `1OL-16-005-E`, tout est ramené à la forme canonique avant recherche). Puis le même formulaire multi-étapes :

- Si le matricule correspond à un `Member` déjà informatisé : les étapes s'ouvrent pré-remplies avec ses données actuelles.
- Si le matricule ne correspond à rien en base (cas des matricules du registre papier jamais informatisés) : le formulaire s'ouvre vide, avec le matricule reporté tel quel dans la soumission.

Dans les deux cas, **aucune donnée existante n'est jamais renvoyée telle quelle au navigateur avant validation admin** — le pré-remplissage se fait côté formulaire au moment de l'ouverture, mais l'écran de confirmation final est neutre :

> « Votre demande a été transmise à l'équipe. »

Jamais de confirmation explicite qu'un matricule donné existe ou non, pour ne pas transformer le formulaire en outil de vérification d'un matricule d'autrui (le format étant séquentiel et donc partiellement devinable).

### Écriture

À l'envoi, aucune écriture dans `Member`. Une entrée `MemberSubmission` est créée avec `statut: "en_attente"`. Route publique `POST /api/submissions`, protégée par une limitation de débit (même middleware que `contactLimiter`, réutilisé pour ce nouvel usage).

## Administration

### Nouvel onglet « Inscriptions » (`CommunityAdmin.jsx`)

File d'attente des `MemberSubmission` avec `statut: "en_attente"` :

```
Inscriptions en attente (3)
┌─────────────────────────────────────────────────┐
│ [nouveau] Jean KOUASSI — EL OLAM        [Examiner]│
│ [maj]     1RO 17-007 G — tél. modifié   [Examiner]│
│ [nouveau] Awa TRAORÉ — SHALOM           [Examiner]│
└─────────────────────────────────────────────────┘
```

« Examiner » ouvre le détail :

- Pour une mise à jour (`type: "maj"`) : comparatif champ par champ entre la valeur actuelle du `Member` et la valeur soumise, uniquement sur les champs modifiés.
- Pour une nouvelle inscription : affichage simple de toutes les données soumises.

Trois actions :

- **Valider** : crée le `Member` (nouveau) ou applique les changements (mise à jour). Si nouveau, attribue le matricule via le compteur atomique de l'église concernée. Marque la soumission `valide`, `traitePar`, `traiteLe`.
- **Rejeter** : demande un motif interne (texte libre), marque la soumission `rejete`. Aucune modification du `Member`.
- **Modifier puis valider** : l'admin corrige un champ (ex. une coquille de téléphone) directement dans le formulaire de revue avant validation.

Chaque validation/rejet est tracé via `audit.record`, comme les autres actions d'administration déjà en place ([backend/src/services/audit.service.js](../../../backend/src/services/audit.service.js)).

### Onglet « Membres » existant

Colonne matricule ajoutée à la liste, recherchable via le champ `search` déjà supporté par `listAdmin`. Le formulaire de saisie manuelle existant (`memberFields` dans `CommunityAdmin.jsx`) s'enrichit des nouveaux champs (état civil, vie spirituelle, engagement, contact étendu) — sans rien retirer de ce qui existe.

### Nouvel onglet « Bergeries »

CRUD simple (code, nom, église), même pattern que Ministères. Alimente la liste déroulante des bergeries dans le formulaire d'inscription public (filtrée par l'église sélectionnée) et dans le formulaire de saisie manuelle en administration.

## Export

### Excel (.xlsx)

`GET /api/admin/members/export.xlsx`, réservée au rôle `admin`. Nouvelle dépendance `exceljs` (aucune librairie de ce type n'est présente dans `backend/package.json` aujourd'hui). Colonnes : matricule, nom, prénom, église, bergerie, téléphone, statut, date d'arrivée. En-tête figée, largeurs de colonnes ajustées, tri/filtre automatique activé. Filtrable par église, bergerie et statut avant génération (paramètres de requête, même logique que `listAdmin`).

### PDF

`GET /api/admin/members/export.pdf`, même filtre, réutilise `pdfkit` (déjà une dépendance du backend, déjà utilisé pour les reçus de dons dans [receipt.service.js](../../../backend/src/services/receipt.service.js)). Reprend la mise en forme du registre papier existant : numéro d'ordre, matricule, nom & prénoms, bergerie ; paginé.

## Sécurité

- `POST /api/submissions` est la seule écriture publique introduite par cette fonctionnalité. Elle n'écrit jamais dans `Member`, uniquement dans `MemberSubmission`. Limitation de débit obligatoire.
- `Member` reste non exposé publiquement en lecture (`publicFilter: { _id: null }` conservé tel quel), et son écriture reste réservée au rôle `admin`, comme aujourd'hui ([backend/src/routes/index.js:342](../../../backend/src/routes/index.js#L342)).
- Aucune confirmation d'existence d'un matricule n'est jamais renvoyée à un utilisateur non authentifié.
- Aucun nouvel appel tiers : la photo passe par Cloudinary, déjà autorisé dans la CSP (`img-src`, `connect-src` dans [vercel.json](../../../vercel.json)) et déjà câblé via `upload.service.js`.
- La lettre de contrôle du matricule permet à l'admin de repérer une saisie manuelle erronée avant validation, mais n'est pas un mécanisme de sécurité — elle ne bloque rien côté serveur au-delà d'un avertissement visuel.

## Hors périmètre

- Correction des deux anomalies du registre papier existant (lignes 015 et 044) — à traiter séparément, hors de cette fonctionnalité.
- Passage à un matricule sur 4 chiffres en cas d'atteinte du plafond de 999 par église.
- Notification par e-mail ou SMS au membre lors de la validation de son inscription (aucun service d'envoi n'est branché sur ce projet à ce jour).
- Authentification des membres eux-mêmes (espace membre avec compte) — le modèle `Member` reste volontairement sans mot de passe, comme documenté dans son fichier source.
