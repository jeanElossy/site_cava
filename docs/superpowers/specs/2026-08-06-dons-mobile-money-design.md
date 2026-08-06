# Refonte du système de dons — paiement Mobile Money manuel — Design

Date : 2026-08-06
Statut : validé par l'utilisateur, en attente de plan d'implémentation.

## Contexte

Le CAVA affiche un QR code pendant les directs (cultes, offrandes) pour recevoir des dons. Le système actuel encaisse via **CinetPay** : le donateur est redirigé vers un guichet hébergé, paie, puis un webhook confirme le paiement côté serveur (voir [backend/src/services/donation.service.js](../../../backend/src/services/donation.service.js) et [backend/src/services/payment/cinetpay.js](../../../backend/src/services/payment/cinetpay.js)).

L'église ne veut plus de CinetPay. Le nouveau principe : le QR code affiché pendant le direct amène simplement sur la page `/donate` du site. Le donateur y choisit un moyen de paiement (Orange/MTN/Moov/Wave), le site affiche le **QR code Mobile Money officiel de l'église** pour ce moyen, le donateur paie **en dehors du site** (dans son application Mobile Money), puis revient déclarer son paiement en saisissant le **numéro de transaction** reçu par SMS. Un administrateur vérifie manuellement ce numéro contre le relevé Mobile Money de l'église et valide ou rejette le don.

Il n'y a plus aucune confirmation automatique de paiement : la validité du don repose entièrement sur la vérification humaine. Le système est conçu pour pouvoir brancher une API de paiement plus tard (le fil `provider` disparaît du modèle, mais rien n'empêche de le réintroduire si l'église automatise un jour).

**Découpage en deux phases**, validé avec l'utilisateur :
- **Phase 1 (ce document)** : nouveau parcours de don, gestion admin des dons, gestion admin des moyens de paiement et des types de don. Remplace complètement CinetPay.
- **Phase 2 (hors périmètre de ce document)** : tableau de bord graphique, exports Excel/PDF, impression, classement des moyens les plus utilisés, notifications admin en temps réel. À spécifier séparément une fois la phase 1 en usage réel.

Réutilise l'infrastructure existante : `createCrudService` + `resourceRouter` pour les nouvelles collections administrables (même pattern que `Event`/`Ministry`/`Testimonial`), l'upload signé Cloudinary déjà utilisé pour les photos d'inscription ([backend/src/services/upload.service.js](../../../backend/src/services/upload.service.js)), le `donationLimiter` existant, l'authentification par rôles (`requireAuth`/`requireRole`), et le générateur de QR serveur (`qrcode`) déjà utilisé pour le QR de la page `/donate` projeté pendant les cultes.

## Décisions actées avec l'utilisateur

- **Pas d'historique CinetPay à conserver** : la collection `Donation` repart de zéro avec le nouveau schéma.
- **Validation/rejet réservés au rôle `admin`** (pas `editor`, qui garde un accès en lecture seule à la liste).
- **Stockage des preuves sur Cloudinary**, pas de disque local Multer : le backend tourne sur Render avec un disque éphémère — tout fichier stocké localement serait perdu au prochain redéploiement. Cloudinary est déjà l'infrastructure d'upload du reste du projet.
- **Numéro de transaction Mobile Money obligatoire**, capture d'écran/photo du reçu **optionnelle en complément**. Décision de l'utilisateur : une capture seule peut être une ancienne capture réutilisée (fraude), alors que le numéro de transaction est propre à l'opération et se vérifie contre le relevé Mobile Money de l'église.
- Le concept de don anonyme (présent dans l'ancien modèle) est retiré : le nouveau parcours exige toujours nom, prénom et téléphone.
- Le champ `project` (projet ciblé par le don) est retiré : les besoins qu'il couvrait (Construction, Mission) deviennent des `DonationType` à part entière, gérés par l'admin.
- Le reçu PDF existant ([backend/src/services/receipt.service.js](../../../backend/src/services/receipt.service.js)) est conservé et adapté (déclenché sur statut `valide` au lieu de `paid`) — coût nul, infra déjà en place.

## Modèles de données

### `PaymentMethod` (nouveau, remplace l'enum `paymentMethod`)

```
{
  name: String,              // "Orange Money"
  image: { url, publicId },  // QR Cloudinary
  accountNumber: String,
  holderName: String,
  active: Boolean,           // false tant que image + numéro ne sont pas renseignés
  order: Number,
}
```

Pré-rempli en base au déploiement avec Orange Money / MTN Money / Moov Money / Wave, `active: false` par défaut — un moyen sans QR réel ne doit jamais apparaître aux fidèles.

### `DonationType` (nouveau, remplace l'enum `contributionType`)

```
{
  name: String,          // "Dîme"
  description: String,
  active: Boolean,
  order: Number,
}
```

Pré-rempli avec Dîme / Offrande / Action de grâce / Construction / Mission / Don libre.

### `Donation` (refonte complète)

```
{
  reference: String (unique, aléatoire, non devinable),  // inchangé

  donor: {
    firstName: String,
    lastName: String,
    phone: String,
    email: String | null,   // optionnel
  },

  amount: Number,            // 200 à 10 000 000 F CFA, comme aujourd'hui
  currency: "XOF",

  donationType: {
    ref: ObjectId (ref DonationType),
    name: String,             // copie du libellé au moment du don
  },

  paymentMethod: {
    ref: ObjectId (ref PaymentMethod),
    name: String,             // copie du libellé au moment du don
  },

  proof: {
    transactionId: String,           // obligatoire
    imageUrl: String | null,         // optionnel, Cloudinary
    submittedAt: Date,
  },

  status: "en_attente" | "valide" | "rejete",
  adminNote: String | null,          // remarque, obligatoire au rejet
  reviewedBy: ObjectId (ref User) | null,
  reviewedAt: Date | null,

  ip: String,
}
, { timestamps: true }
```

Champs retirés par rapport à l'ancien modèle : `provider`, `providerTransactionId`, `providerPayload`, `paidWith`, `recurring`, `project`, `donor.anonymous`.

Snapshot du libellé (`donationType.name`, `paymentMethod.name`) en plus de la référence : si un admin renomme ou désactive un type/moyen après coup, l'historique des dons passés reste lisible tel qu'il était au moment du don.

Index conservés : `{ status: 1, createdAt: -1 }` (liste admin filtrée), `{ createdAt: -1 }`.

## API

### Publiques

- `GET /api/donation-types` — types actifs, triés par `order`
- `GET /api/payment-methods` — moyens actifs, triés par `order` (inclut l'image QR)
- `POST /api/donations/proof-signature` — signature Cloudinary pour le dossier `donations`, même mécanisme que `POST /api/uploads/signature` (dossier `members`) déjà utilisé publiquement pour les photos d'inscription. Limité par `publicUploadLimiter`.
- `POST /api/donations` — crée le don, preuve déjà déposée (le corps contient `proof.imageUrl` si fourni, jamais le fichier lui-même). Limité par `donationLimiter` (15 tentatives/15 min/IP, déjà en place). La réponse renvoie `{ reference, status: "en_attente" }`, suffisant pour l'écran de confirmation côté client — aucun autre appel n'est nécessaire.

Retirées : `POST /donations/webhook`, `GET /donations/:reference` (statut public — plus nécessaire, la confirmation est affichée immédiatement côté client après soumission, pas de suivi ultérieur en phase 1).

### Admin

- `mount("payment-methods", paymentMethods, { writeRoles: ["admin"], readRoles: ["admin", "editor"], auditResource: "paymentMethod" })`
- `mount("donation-types", donationTypes, { writeRoles: ["admin"], readRoles: ["admin", "editor"], auditResource: "donationType" })`
- `GET /admin/donations` — liste, filtres `status`/`donationType`/`paymentMethod`, pagination (inchangé dans l'esprit de l'existant)
- `GET /admin/donations/summary` — compteurs par statut (base pour la phase 2)
- `POST /admin/donations/:id/review` `{ decision: "valide" | "rejete", note }` — **`requireRole("admin")` strictement**, `note` obligatoire si `decision === "rejete"`
- `GET /admin/donations/qrcode` — **conservé tel quel**, génère le QR à projeter pendant le culte, pointant vers `/donate?type=...&amount=...` ; indépendant de CinetPay, rien à changer

## Parcours de don (frontend)

Le tunnel `ContributionForm` existant ([src/components/donate/ContributionForm/index.jsx](../../../src/components/donate/ContributionForm/index.jsx)), déjà construit comme un assistant à étapes, passe de 3 à 4 étapes :

1. **Identité + montant + type** — nom, prénom, téléphone (obligatoires), email (optionnel), montant, type de don (`GET /api/donation-types`)
2. **Moyen de paiement** — liste des moyens actifs (`GET /api/payment-methods`)
3. **QR à scanner** *(nouveau)* — affiche le QR du moyen choisi, le montant, le nom du donateur, le type de don ; bouton « J'ai effectué le paiement »
4. **Preuve** *(nouveau)* — champ numéro de transaction (obligatoire) + upload optionnel d'une capture/photo (signature Cloudinary puis upload direct navigateur → Cloudinary, comme le flux d'inscription) ; soumission → `POST /api/donations` → écran de confirmation « Merci, votre don est en attente de vérification. »

Suppressions : page `DonationReturn` et route `/donate/retour` (retour CinetPay), le check `paymentConfig()/paymentEnabled` dans `ContributionForm` (plus de passerelle à activer/désactiver, le don manuel est toujours disponible).

## Administration

- **`DonationsAdmin.jsx`** : nouveaux statuts (`En attente` / `Validé` / `Rejeté`), colonne preuve (numéro de transaction affiché en clair + lien vers l'image si fournie), actions Valider/Rejeter avec champ remarque (obligatoire au rejet). Suppression du bandeau « paiement non configuré » (n'a plus de sens sans passerelle).
- **`PaymentMethodsAdmin.jsx`** *(nouveau)* : CRUD sur le même gabarit que `TestimonialsAdmin`/`MinistriesAdmin` — nom, upload de l'image QR, numéro de compte, titulaire, actif/inactif, ordre.
- **`DonationTypesAdmin.jsx`** *(nouveau)* : CRUD similaire, plus simple (pas d'image) — nom, description, actif/inactif, ordre.
- Les deux nouvelles pages sont ajoutées à la navigation de `AdminLayout`.

## Nettoyage CinetPay

- Suppression de [backend/src/services/payment/cinetpay.js](../../../backend/src/services/payment/cinetpay.js)
- Suppression de la route `POST /donations/webhook`
- Suppression des variables `CINETPAY_*` dans `.env.example` et `backend/src/config/env.js` (dont `isPaymentConfigured`)
- Suppression de `DonationReturn` (page) et de la route `/donate/retour`
- Le composant `ReceiptActions` est conservé (le reçu PDF survit à la refonte, voir plus haut)

## Risques de fraude et mitigations

| Risque | Mitigation |
|---|---|
| Numéro de transaction inventé ou copié d'un autre don | Vérification manuelle obligatoire par l'admin contre le relevé Mobile Money réel de l'église avant validation — aucune confirmation automatique n'existe dans ce modèle, c'est le compromis assumé par l'église |
| Capture d'écran réutilisée d'un ancien paiement | C'est justement pourquoi la capture est reléguée au rang de complément optionnel ; le numéro de transaction, propre à chaque opération, est la preuve qui fait foi |
| Spam de fausses déclarations de don | `donationLimiter` existant (15 tentatives/15 min/IP) + validation stricte du type/poids de fichier à l'upload Cloudinary |
| Modification frauduleuse d'un moyen de paiement (numéro/QR) | Écriture sur `PaymentMethod`/`DonationType` réservée au rôle `admin` |
| Validation abusive par un compte non autorisé | `POST /admin/donations/:id/review` strictement réservé à `admin`, `editor` ne peut que consulter |
| Don validé deux fois / rejeté après validation (incohérence) | Décision définitive côté service : `POST /admin/donations/:id/review` n'accepte que les dons encore `en_attente` ; un don déjà `valide` ou `rejete` renvoie une erreur plutôt que d'écraser la décision précédente — pas de mécanisme de réouverture en phase 1 |

## Design visuel

Direction validée avec l'utilisateur : palette imposée par le brief (`#0D7E58` vert, `#F4C61D` jaune, blanc), déclinée en un système de jetons ancré dans l'univers du CAVA plutôt que dans un style générique.

**Palette** :
- `--sowing-green` `#0D7E58` — primaire, boutons, étapes validées
- `--harvest-gold` `#F4C61D` — accent, CTA principal
- `--deep-canopy` `#08321F` — vert quasi-noir, titres et fonds premium (billet, hero)
- `--linen` `#FBF9F4` — fond général chaud (pas blanc pur)
- `--sage-mist` `#EAF3EE` — fond de carte secondaire / alternance de section

**Typographie** : *Fraunces* (serif variable) en display — réservée aux titres et au montant affiché en grand — associée à Poppins (déjà chargée sur tout le site) pour le corps et l'UI. Un seul ajout Google Fonts, utilisé avec retenue. Icônes : `lucide-react` (déjà une dépendance, déjà utilisée dans `DonationsAdmin.jsx`) — le module dons s'aligne dessus plutôt que de mélanger avec `react-icons/fa` utilisé aujourd'hui dans l'ancien `ContributionForm`.

**Signature — le billet d'offrande numérique** : l'étape « QR à scanner » et l'écran de confirmation reprennent la forme d'une enveloppe d'offrande physique réinventée en numérique — carte à bord perforé (encoches rondes, bordure en tirets), dégradé `--deep-canopy` → `--sowing-green`, QR en médaillon blanc, montant en Fraunces XL doré.

**Indicateur d'étapes — semer pour récolter** : les 4 étapes ne sont pas numérotées 1-2-3-4 mais suivent une progression thématique (semence → pousse → feuille → épi), écho direct au nom « Vie et Abondance » et à l'image biblique de la semence.

**Layout** : format à deux colonnes conservé (formulaire / récapitulatif), fond `--linen` avec dégradé radial subtil en haut de page. Cartes à coins arrondis 20–24px, ombres douces à deux couches, jamais de bordure dure.

## Hors périmètre (phase 2)

Tableau de bord graphique, export Excel, export PDF, impression, total par période, classement des moyens de paiement les plus utilisés, notifications admin (probablement via l'infra push existante — VAPID déjà en place pour d'autres modules — plutôt qu'un nouveau canal).
