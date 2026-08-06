# Refonte du système de dons (Mobile Money manuel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système de dons CinetPay par un parcours de don Mobile Money manuel (QR statique par moyen de paiement, preuve par numéro de transaction, validation admin), avec gestion admin des moyens de paiement et des types de don.

**Architecture:** Backend Express/MongoDB existant, réutilisation intégrale de `createCrudService`/`resourceRouter` pour les deux nouvelles collections administrables, upload signé Cloudinary déjà en place. Frontend React : le tunnel `ContributionForm` existant (3 étapes) devient 4 étapes, alimentées par l'API au lieu de données codées en dur.

**Tech Stack:** Node.js/Express/Mongoose (`node --test` + `node:assert/strict` pour les tests backend), React 19/Vite (`vitest` + `@testing-library/react` pour les tests frontend), Cloudinary (upload signé), `lucide-react` pour les icônes.

## Global Constraints

- Spec source : [docs/superpowers/specs/2026-08-06-dons-mobile-money-design.md](../specs/2026-08-06-dons-mobile-money-design.md) — toute divergence avec ce plan doit être résolue en faveur de la spec.
- Pas d'historique CinetPay à conserver : le modèle `Donation` repart de zéro (base de dev/prod encore sans dons réels significatifs).
- Preuves stockées sur **Cloudinary**, jamais sur disque local (Render a un disque éphémère).
- Numéro de transaction Mobile Money **obligatoire**, capture d'écran **optionnelle**.
- Validation/rejet d'un don réservés au rôle `admin` (pas `editor`).
- Palette : `--sowing-green` `#0D7E58`, `--harvest-gold` `#F4C61D`, `--deep-canopy` `#08321F`, `--linen` `#FBF9F4`, `--sage-mist` `#EAF3EE`. Ces tokens sont scopés sous `.contribution-form` (jamais sur `:root`) — voir le piège des classes globales documenté dans `CLAUDE.md`.
- Typographie : police d'affichage *Fraunces* (nouvel ajout Google Fonts) réservée aux titres et montants, le reste du texte reste en Poppins (déjà chargée).
- Icônes du module dons : `lucide-react` uniquement (déjà une dépendance), pas `react-icons/fa`.
- Aucune commande `npm test` n'existe à la racine du monorepo : les tests backend se lancent avec `cd backend && npm test` (Node test runner), les tests frontend avec `npm test` à la racine (vitest).
- Aucune nouvelle dépendance npm au-delà de la police Google Fonts (toutes les librairies nécessaires — `lucide-react`, `qrcode`, Cloudinary signé — sont déjà présentes).

---

## File Structure

**Backend — créés :**
- `backend/src/models/PaymentMethod.js` + `PaymentMethod.test.js`
- `backend/src/models/DonationType.js` + `DonationType.test.js`
- `backend/src/models/Donation.test.js`

**Backend — modifiés :**
- `backend/src/models/Donation.js` (refonte complète)
- `backend/src/services/donation.service.js` (refonte complète) + `donation.service.test.js` (nouveau)
- `backend/src/services/upload.service.js` (ajout dossiers `donations` et `paymentMethods`)
- `backend/src/services/receipt.service.js` (adaptation au nouveau modèle)
- `backend/src/routes/index.js` (section dons réécrite)
- `backend/src/config/env.js` (suppression CinetPay)
- `backend/.env.example` (suppression CinetPay)
- `backend/src/scripts/seed-data.js` et `seed.js` (amorçage des moyens de paiement et types de don)

**Backend — supprimés :**
- `backend/src/services/payment/cinetpay.js`

**Frontend — créés :**
- `src/context/contributionReducer.test.js`
- `src/components/donate/ContributionForm/StepIdentity.jsx`
- `src/components/donate/ContributionForm/StepPaymentMethod.jsx`
- `src/components/donate/ContributionForm/StepQrTicket.jsx`
- `src/components/donate/ContributionForm/StepProof.jsx`
- `src/components/donate/ContributionForm/ContributionForm.test.jsx`
- `src/pages/admin/PaymentMethodsAdmin.jsx`
- `src/pages/admin/DonationTypesAdmin.jsx`

**Frontend — modifiés :**
- `src/context/contributionReducer.js` (refonte de l'état)
- `src/components/donate/ContributionForm/data.js` (retrait des données codées en dur)
- `src/components/donate/ContributionForm/SummaryCard.jsx`
- `src/components/donate/ContributionForm/index.jsx` (orchestration à 4 étapes)
- `src/components/donate/ContributionForm/ContributionForm.scss` (tokens visuels + billet)
- `src/services/donations.js` (refonte complète)
- `src/services/uploads.js` (ajout `uploadDonationProof`)
- `src/services/api.js` (ajout collections `paymentMethods`/`donationTypes`)
- `src/pages/admin/DonationsAdmin.jsx` + `.scss` (nouveaux statuts, preuve, validation)
- `src/routes/AppRoutes.jsx` (retrait de `/donate/retour`)
- `src/routes/AdminRoutes.jsx` (deux nouvelles routes)
- `src/pages/admin/AdminLayout.jsx` (deux nouvelles entrées de navigation)
- `index.html` (police Fraunces)

**Frontend — supprimés :**
- `src/pages/DonationReturn/` (dossier complet)
- `src/components/donate/ReceiptActions/` (dossier complet)

---

## Task 1: Modèle `PaymentMethod`

**Files:**
- Create: `backend/src/models/PaymentMethod.js`
- Test: `backend/src/models/PaymentMethod.test.js`

**Interfaces:**
- Produces: `PaymentMethod` (modèle Mongoose par défaut) avec champs `{ name, image: { url, publicId }, accountNumber, holderName, active, order }`.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/models/PaymentMethod.test.js
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import PaymentMethod from "./PaymentMethod.js";

const TEST_NAME = "Moyen de test ZZ";

const cleanup = () => PaymentMethod.deleteMany({ name: TEST_NAME });

describe("PaymentMethod (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée un moyen de paiement avec les valeurs par défaut", async () => {
    const method = await PaymentMethod.create({
      name: TEST_NAME,
      accountNumber: "0700000000",
      holderName: "CAVA",
    });

    assert.equal(method.active, false);
    assert.equal(method.order, 0);
    assert.equal(method.image.url, undefined);
  });

  it("exige un nom", async () => {
    await assert.rejects(
      PaymentMethod.create({ accountNumber: "0700000000", holderName: "CAVA" })
    );
  });

  it("accepte une image Cloudinary", async () => {
    const method = await PaymentMethod.create({
      name: TEST_NAME,
      accountNumber: "0700000000",
      holderName: "CAVA",
      image: { url: "https://res.cloudinary.com/x/y.png", publicId: "cava/dons/x" },
      active: true,
      order: 2,
    });

    assert.equal(method.image.url, "https://res.cloudinary.com/x/y.png");
    assert.equal(method.active, true);
    assert.equal(method.order, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test src/models/PaymentMethod.test.js`
Expected: FAIL — `Cannot find module './PaymentMethod.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/models/PaymentMethod.js
import mongoose from "mongoose";

// Moyen de paiement Mobile Money de l'église (Orange Money, MTN
// Money, Moov Money, Wave...). Remplace l'ancien enum `paymentMethod`
// codé en dur dans Donation : un numéro qui change ou un nouvel
// opérateur ne demandent plus de toucher au code, seulement à
// l'administration.
//
// `active: false` par défaut : un moyen fraîchement créé n'a pas
// encore de QR ni de numéro renseignés, et ne doit jamais apparaître
// aux fidèles tant que l'administrateur ne l'a pas explicitement
// activé.
const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du moyen de paiement est obligatoire."],
      trim: true,
      maxlength: 60,
    },

    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },

    accountNumber: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },

    holderName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },

    active: { type: Boolean, default: false },

    // Ordre d'affichage dans le tunnel de don, plus petit en premier.
    order: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

paymentMethodSchema.index({ active: 1, order: 1 });

export default mongoose.model("PaymentMethod", paymentMethodSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test src/models/PaymentMethod.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/PaymentMethod.js backend/src/models/PaymentMethod.test.js
git commit -m "feat(dons): ajoute le modèle PaymentMethod"
```

---

## Task 2: Modèle `DonationType`

**Files:**
- Create: `backend/src/models/DonationType.js`
- Test: `backend/src/models/DonationType.test.js`

**Interfaces:**
- Produces: `DonationType` (modèle Mongoose par défaut) avec champs `{ name, description, active, order }`.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/models/DonationType.test.js
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import DonationType from "./DonationType.js";

const TEST_NAME = "Type de test ZZ";

const cleanup = () => DonationType.deleteMany({ name: TEST_NAME });

describe("DonationType (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée un type de don actif par défaut", async () => {
    const type = await DonationType.create({ name: TEST_NAME });

    assert.equal(type.active, true);
    assert.equal(type.order, 0);
  });

  it("exige un nom", async () => {
    await assert.rejects(DonationType.create({ description: "sans nom" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test src/models/DonationType.test.js`
Expected: FAIL — module introuvable

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/models/DonationType.js
import mongoose from "mongoose";

// Type de don (Dîme, Offrande, Action de grâce, Construction,
// Mission, Don libre...). Remplace l'ancien enum `contributionType`
// codé en dur dans Donation — un besoin qui apparaît (une nouvelle
// campagne de construction, par exemple) devient une entrée
// d'administration plutôt qu'un déploiement.
//
// `active: true` par défaut, contrairement à PaymentMethod : un type
// de don n'a pas de dépendance externe (QR, numéro) à renseigner
// avant de pouvoir être proposé.
const donationTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du type de don est obligatoire."],
      trim: true,
      maxlength: 60,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },

    active: { type: Boolean, default: true },

    order: { type: Number, default: 0 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

donationTypeSchema.index({ active: 1, order: 1 });

export default mongoose.model("DonationType", donationTypeSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test src/models/DonationType.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/DonationType.js backend/src/models/DonationType.test.js
git commit -m "feat(dons): ajoute le modèle DonationType"
```

---

## Task 3: Refonte du modèle `Donation`

**Files:**
- Modify: `backend/src/models/Donation.js` (remplacement intégral)
- Create: `backend/src/models/Donation.test.js`

**Interfaces:**
- Consumes: `PaymentMethod`, `DonationType` (Task 1, Task 2) — référencés par `ObjectId`, jamais peuplés par défaut.
- Produces: `Donation` (modèle Mongoose par défaut) avec `{ reference, donor: {firstName, lastName, phone, email}, amount, currency, donationType: {ref, name}, paymentMethod: {ref, name}, proof: {transactionId, imageUrl, submittedAt}, status, adminNote, reviewedBy, reviewedAt, ip }`. `status` ∈ `"en_attente" | "valide" | "rejete"`.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/models/Donation.test.js
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Donation from "./Donation.js";

const TEST_PHONE = "0700000099";

const cleanup = () => Donation.deleteMany({ "donor.phone": TEST_PHONE });

const validPayload = () => ({
  donor: {
    firstName: "Jean",
    lastName: "Kouassi",
    phone: TEST_PHONE,
    email: "jean@example.invalid",
  },
  amount: 5000,
  donationType: { name: "Dîme" },
  paymentMethod: { name: "Orange Money" },
  proof: { transactionId: "MP240101.1234.A12345" },
});

describe("Donation (modèle)", () => {
  before(async () => {
    await connectTestDb();
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await disconnectTestDb();
  });

  it("crée un don avec le statut « en_attente » par défaut", async () => {
    const donation = await Donation.create(validPayload());

    assert.equal(donation.status, "en_attente");
    assert.equal(donation.currency, "XOF");
    assert.match(donation.reference, /^CAVA-[0-9A-F]{16}$/);
  });

  it("exige le numéro de transaction", async () => {
    const payload = validPayload();
    delete payload.proof.transactionId;

    await assert.rejects(Donation.create(payload));
  });

  it("exige le téléphone du donateur", async () => {
    const payload = validPayload();
    delete payload.donor.phone;

    await assert.rejects(Donation.create(payload));
  });

  it("rejette un montant en dessous du minimum", async () => {
    await assert.rejects(
      Donation.create({ ...validPayload(), amount: 100 })
    );
  });

  it("n'expose pas providerPayload en JSON (champ hérité retiré du schéma)", async () => {
    const donation = await Donation.create(validPayload());

    assert.equal(donation.toJSON().providerPayload, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test src/models/Donation.test.js`
Expected: FAIL — le schéma actuel n'a pas de champ `proof`, `donationType` etc. (contrainte `paymentMethod` actuelle est un enum de chaîne, pas un sous-document)

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/models/Donation.js
import crypto from "node:crypto";

import mongoose from "mongoose";

// Don déclaré par un fidèle, réglé en dehors du site (Mobile Money),
// et vérifié manuellement par un administrateur.
//
// ------------------------------------------------------------------
// AUCUNE CONFIRMATION AUTOMATIQUE
// ------------------------------------------------------------------
// Contrairement à l'ancien modèle (CinetPay), rien ici ne prouve
// qu'un paiement a réellement eu lieu : le donateur déclare un
// montant et un numéro de transaction, l'admin vérifie contre le
// relevé Mobile Money réel de l'église avant de valider. C'est un
// compromis assumé — voir la spec pour la discussion des risques de
// fraude et pourquoi le numéro de transaction est obligatoire alors
// que la capture d'écran ne l'est pas (une capture peut être une
// ancienne capture réutilisée).
const donationSchema = new mongoose.Schema(
  {
    // Référence publique, non devinable — sert de clé pour le reçu
    // (voir receipt.service.js) une fois le don validé.
    reference: {
      type: String,
      unique: true,
      index: true,
      default: () =>
        `CAVA-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    },

    donor: {
      firstName: {
        type: String,
        required: [true, "Le prénom est obligatoire."],
        trim: true,
        maxlength: 60,
      },
      lastName: {
        type: String,
        required: [true, "Le nom est obligatoire."],
        trim: true,
        maxlength: 60,
      },
      phone: {
        type: String,
        required: [true, "Le téléphone est obligatoire."],
        trim: true,
        maxlength: 30,
      },
      email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    },

    amount: {
      type: Number,
      required: [true, "Le montant est obligatoire."],
      min: [200, "Le montant minimum est de 200 F CFA."],
      max: [10000000, "Le montant maximum est de 10 000 000 F CFA."],
    },

    currency: {
      type: String,
      enum: ["XOF"],
      default: "XOF",
    },

    // `ref` pointe vers la collection administrable ; `name` est une
    // copie figée au moment du don — si un type/moyen est renommé ou
    // désactivé plus tard, l'historique reste lisible tel qu'il était.
    donationType: {
      ref: { type: mongoose.Schema.Types.ObjectId, ref: "DonationType" },
      name: {
        type: String,
        required: [true, "Le type de don est obligatoire."],
        trim: true,
        maxlength: 60,
      },
    },

    paymentMethod: {
      ref: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
      name: {
        type: String,
        required: [true, "Le moyen de paiement est obligatoire."],
        trim: true,
        maxlength: 60,
      },
    },

    proof: {
      transactionId: {
        type: String,
        required: [
          true,
          "Le numéro de transaction Mobile Money est obligatoire.",
        ],
        trim: true,
        maxlength: 60,
      },
      imageUrl: { type: String, trim: true, default: "" },
      submittedAt: { type: Date, default: Date.now },
    },

    status: {
      type: String,
      enum: ["en_attente", "valide", "rejete"],
      default: "en_attente",
      index: true,
    },

    adminNote: { type: String, trim: true, maxlength: 400, default: "" },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,

    ip: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

// Les deux lectures faites par l'administration : la liste récente,
// et le filtre par statut.
donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ createdAt: -1 });

export default mongoose.model("Donation", donationSchema);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test src/models/Donation.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/Donation.js backend/src/models/Donation.test.js
git commit -m "feat(dons): refonte du modèle Donation pour le paiement Mobile Money manuel"
```

---

## Task 4: Refonte de `donation.service.js`

**Files:**
- Modify: `backend/src/services/donation.service.js` (remplacement intégral)
- Create: `backend/src/services/donation.service.test.js`

**Interfaces:**
- Consumes: `Donation` (Task 3), `PaymentMethod` (Task 1), `DonationType` (Task 2), `ApiError` (`backend/src/utils/ApiError.js`, déjà existant).
- Produces:
  - `createDonation(input, { ip }) -> Promise<{ reference, status }>`
  - `adminList({ status, donationType, paymentMethod, limit, page }) -> Promise<{ items, total, page, perPage }>`
  - `adminSummary() -> Promise<{ en_attente: {count}, valide: {count, total}, rejete: {count}, thisMonth: {count, total} }>`
  - `review(id, { decision, note }, user) -> Promise<Donation>` — `decision` ∈ `"valide" | "rejete"`
  - `publicSiteUrl() -> string` (conservé pour le générateur de QR de la page /donate)

- [ ] **Step 1: Write the failing test**

```js
// backend/src/services/donation.service.test.js
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { connectTestDb, disconnectTestDb } from "../test/db.js";
import Donation from "../models/Donation.js";
import PaymentMethod from "../models/PaymentMethod.js";
import DonationType from "../models/DonationType.js";
import User from "../models/User.js";
import * as donationService from "./donation.service.js";

const TEST_PHONE = "0700000098";

let method;
let type;
let admin;

const cleanup = async () => {
  await Donation.deleteMany({ "donor.phone": TEST_PHONE });
};

const basePayload = () => ({
  donor: {
    firstName: "Awa",
    lastName: "Traoré",
    phone: TEST_PHONE,
    email: "",
  },
  amount: 15000,
  donationTypeId: String(type._id),
  paymentMethodId: String(method._id),
  proof: { transactionId: "MP240101.9999.B54321" },
});

describe("donation.service (intégration MongoDB)", () => {
  before(async () => {
    await connectTestDb();

    method = await PaymentMethod.create({
      name: "Orange Money Test",
      accountNumber: "0700000000",
      holderName: "CAVA",
      active: true,
    });

    type = await DonationType.create({ name: "Dîme Test", active: true });

    admin = await User.findOne({ role: "admin" });

    if (!admin) {
      admin = await User.create({
        name: "Admin Test Dons",
        email: "admin.donation.testsuite@example.invalid",
        password: "MotDePasseTemporaire123!",
        role: "admin",
      });
    }
  });

  beforeEach(cleanup);
  after(async () => {
    await cleanup();
    await PaymentMethod.deleteOne({ _id: method._id });
    await DonationType.deleteOne({ _id: type._id });
    await disconnectTestDb();
  });

  it("crée un don en attente avec le libellé du type et du moyen figé", async () => {
    const result = await donationService.createDonation(basePayload(), {
      ip: "127.0.0.1",
    });

    assert.equal(result.status, "en_attente");
    assert.match(result.reference, /^CAVA-/);

    const stored = await Donation.findOne({ reference: result.reference });

    assert.equal(stored.donationType.name, "Dîme Test");
    assert.equal(stored.paymentMethod.name, "Orange Money Test");
  });

  it("refuse un don sans numéro de transaction", async () => {
    const payload = basePayload();
    delete payload.proof.transactionId;

    await assert.rejects(() => donationService.createDonation(payload, {}));
  });

  it("refuse un moyen de paiement inactif", async () => {
    const inactive = await PaymentMethod.create({
      name: "Moyen inactif test",
      active: false,
    });

    await assert.rejects(() =>
      donationService.createDonation(
        { ...basePayload(), paymentMethodId: String(inactive._id) },
        {}
      )
    );

    await PaymentMethod.deleteOne({ _id: inactive._id });
  });

  it("valide un don en attente et enregistre qui a décidé", async () => {
    const created = await donationService.createDonation(basePayload(), {});
    const stored = await Donation.findOne({ reference: created.reference });

    const reviewed = await donationService.review(
      stored._id,
      { decision: "valide" },
      admin
    );

    assert.equal(reviewed.status, "valide");
    assert.equal(String(reviewed.reviewedBy), String(admin._id));
    assert.ok(reviewed.reviewedAt);
  });

  it("exige une remarque pour rejeter un don", async () => {
    const created = await donationService.createDonation(basePayload(), {});
    const stored = await Donation.findOne({ reference: created.reference });

    await assert.rejects(() =>
      donationService.review(stored._id, { decision: "rejete" }, admin)
    );
  });

  it("refuse de re-décider un don déjà tranché", async () => {
    const created = await donationService.createDonation(basePayload(), {});
    const stored = await Donation.findOne({ reference: created.reference });

    await donationService.review(stored._id, { decision: "valide" }, admin);

    await assert.rejects(() =>
      donationService.review(
        stored._id,
        { decision: "rejete", note: "trop tard" },
        admin
      )
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test src/services/donation.service.test.js`
Expected: FAIL — les fonctions actuelles (`createDonation` attend `paymentMethod` en string CinetPay, pas de `review`) ne correspondent plus au contrat attendu

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/services/donation.service.js
import Donation from "../models/Donation.js";
import PaymentMethod from "../models/PaymentMethod.js";
import DonationType from "../models/DonationType.js";

import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

// Logique métier des dons.
//
// Aucune confirmation automatique n'existe dans ce modèle : la seule
// autorité sur le statut d'un don est `review()`, appelée par un
// administrateur après vérification manuelle du relevé Mobile Money
// de l'église. Voir la spec pour la discussion complète des risques
// de fraude.

const MIN_AMOUNT = 200;
const MAX_AMOUNT = 10000000;

const asString = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// ------------------------------------------------------------------
// CRÉATION
// ------------------------------------------------------------------

export const createDonation = async (input, { ip } = {}) => {
  const amount = Number(input?.amount);

  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    throw ApiError.unprocessable("Le montant du don est invalide.", {
      amount: `Indiquez un montant entier entre ${MIN_AMOUNT} et ${MAX_AMOUNT} F CFA.`,
    });
  }

  const firstName = asString(input?.donor?.firstName, 60);
  const lastName = asString(input?.donor?.lastName, 60);
  const phone = asString(input?.donor?.phone, 30);

  if (!firstName || !lastName || !phone) {
    throw ApiError.unprocessable("Vos coordonnées sont incomplètes.", {
      donor: "Prénom, nom et téléphone sont obligatoires.",
    });
  }

  const transactionId = asString(input?.proof?.transactionId, 60);

  if (!transactionId) {
    throw ApiError.unprocessable(
      "Le numéro de transaction Mobile Money est obligatoire.",
      {
        transactionId:
          "Saisissez le numéro reçu par SMS après votre paiement.",
      }
    );
  }

  // Le type et le moyen sont revalidés côté serveur — un navigateur
  // pourrait envoyer un identifiant inactif ou inexistant, obtenu
  // avant qu'un administrateur ne désactive l'entrée entre-temps.
  const [type, method] = await Promise.all([
    DonationType.findOne({ _id: input?.donationTypeId, active: true }),
    PaymentMethod.findOne({ _id: input?.paymentMethodId, active: true }),
  ]);

  if (!type) {
    throw ApiError.unprocessable("Type de don invalide.", {
      donationTypeId: "Choisissez un type de don proposé.",
    });
  }

  if (!method) {
    throw ApiError.unprocessable("Moyen de paiement invalide.", {
      paymentMethodId: "Choisissez un moyen de paiement proposé.",
    });
  }

  const donation = await Donation.create({
    donor: {
      firstName,
      lastName,
      phone,
      email: asString(input?.donor?.email, 160),
    },
    amount,
    donationType: { ref: type._id, name: type.name },
    paymentMethod: { ref: method._id, name: method.name },
    proof: {
      transactionId,
      imageUrl: asString(input?.proof?.imageUrl, 400),
    },
    ip,
  });

  return { reference: donation.reference, status: donation.status };
};

// ------------------------------------------------------------------
// ADMINISTRATION
// ------------------------------------------------------------------

export const adminList = async ({
  status,
  donationType,
  paymentMethod,
  limit = 50,
  page = 1,
} = {}) => {
  const filter = {};

  if (["en_attente", "valide", "rejete"].includes(status)) {
    filter.status = status;
  }

  if (donationType) filter["donationType.ref"] = donationType;
  if (paymentMethod) filter["paymentMethod.ref"] = paymentMethod;

  const perPage = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const current = Math.max(Number(page) || 1, 1);

  const [items, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage)
      .lean(),

    Donation.countDocuments(filter),
  ]);

  return { items, total, page: current, perPage };
};

export const adminSummary = async () => {
  const startOfMonth = new Date();

  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [totals, monthly] = await Promise.all([
    Donation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),

    Donation.aggregate([
      { $match: { status: "valide", reviewedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(
    totals.map((row) => [row._id, { count: row.count, total: row.total }])
  );

  return {
    en_attente: byStatus.en_attente ?? { count: 0, total: 0 },
    valide: byStatus.valide ?? { count: 0, total: 0 },
    rejete: byStatus.rejete ?? { count: 0, total: 0 },
    thisMonth: monthly[0]
      ? { count: monthly[0].count, total: monthly[0].total }
      : { count: 0, total: 0 },
  };
};

// Décision finale et irréversible : un don `en_attente` peut devenir
// `valide` ou `rejete`, mais plus jamais rouvert. Un rejet exige une
// remarque — c'est ce que verra le personnel qui recontacte le
// donateur, et ce que l'admin relira en cas de contestation.
export const review = async (id, { decision, note } = {}, user) => {
  if (!["valide", "rejete"].includes(decision)) {
    throw ApiError.badRequest("Décision invalide.");
  }

  const trimmedNote = asString(note, 400);

  if (decision === "rejete" && !trimmedNote) {
    throw ApiError.unprocessable(
      "Une remarque est obligatoire pour rejeter un don.",
      { note: "Expliquez pourquoi ce don est rejeté." }
    );
  }

  const donation = await Donation.findOneAndUpdate(
    { _id: id, status: "en_attente" },
    {
      status: decision,
      adminNote: trimmedNote,
      reviewedBy: user?.id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!donation) {
    const existing = await Donation.findById(id).lean();

    if (!existing) throw ApiError.notFound("Don introuvable.");

    throw ApiError.conflict(
      `Ce don a déjà été ${existing.status === "valide" ? "validé" : "rejeté"}.`
    );
  }

  return donation;
};

// ------------------------------------------------------------------
// REÇU
// ------------------------------------------------------------------
// Seul un don VALIDÉ donne lieu à un reçu — voir receipt.service.js.
export const receiptFor = async (reference) => {
  const donation = await Donation.findOne({ reference });

  if (!donation) {
    throw ApiError.notFound("Don introuvable.");
  }

  if (donation.status !== "valide") {
    throw ApiError.badRequest(
      donation.status === "en_attente"
        ? "Ce don n'est pas encore vérifié. Le reçu sera disponible dès sa validation."
        : "Aucun reçu ne peut être émis pour cette contribution."
    );
  }

  return donation;
};

export const publicSiteUrl = () => env.PUBLIC_SITE_URL;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test src/services/donation.service.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/donation.service.js backend/src/services/donation.service.test.js
git commit -m "feat(dons): refonte de donation.service.js pour le paiement Mobile Money manuel"
```

---

## Task 5: `upload.service.js` — dossiers `donations` et `paymentMethods`

**Files:**
- Modify: `backend/src/services/upload.service.js:39-45` (objet `FOLDERS`)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `createSignature({ folder: "donations" | "paymentMethods" })` accepté en plus des dossiers existants.

- [ ] **Step 1: Modifier l'allowlist**

```js
// backend/src/services/upload.service.js
const FOLDERS = {
  medias: "cava/medias",
  events: "cava/events",
  ministries: "cava/ministries",
  members: "cava/members",
  // Preuves de don (public, non authentifié — voir la route dédiée
  // POST /api/donations/proof-signature) et QR des moyens de
  // paiement (admin, via /api/admin/uploads/signature).
  donations: "cava/donations",
  paymentMethods: "cava/payment-methods",
  divers: "cava/divers",
};
```

- [ ] **Step 2: Vérifier qu'aucun test existant ne casse**

Run: `cd backend && node --test src/services/`
Expected: PASS (aucun test dédié à `upload.service.js` aujourd'hui — cette modification est couverte indirectement par les tests de route du Task 6)

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/upload.service.js
git commit -m "feat(dons): ajoute les dossiers Cloudinary donations et paymentMethods"
```

---

## Task 6: Câblage des routes backend

**Files:**
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `donationService.{createDonation, adminList, adminSummary, review, receiptFor, publicSiteUrl}` (Task 4), `createCrudService` + `resourceRouter` (existants), `PaymentMethod`/`DonationType` (Task 1/2), `publicUploadLimiter`/`donationLimiter` (déjà importés).
- Produces les routes suivantes (publiques sauf mention) :
  - `GET /api/donation-types`, `GET /api/payment-methods`
  - `POST /api/donations/proof-signature`
  - `POST /api/donations`
  - `GET /api/donations/:reference/recu`
  - `GET/POST/PATCH/DELETE /api/admin/donation-types`, `/api/admin/payment-methods`
  - `GET /api/admin/donations`, `GET /api/admin/donations/summary`, `POST /api/admin/donations/:id/review`
  - `GET /api/admin/donations/qrcode` (conservée telle quelle)

- [ ] **Step 1: Ajouter les imports et les deux services CRUD génériques**

Après l'import de `Church` (ligne ~12) :

```js
import PaymentMethod from "../models/PaymentMethod.js";
import DonationType from "../models/DonationType.js";
```

Près de la déclaration de `testimonials` (les services CRUD de contenu, ~ligne 154) :

```js
const paymentMethods = createCrudService(PaymentMethod, {
  label: "Moyen de paiement",
  defaultSort: { order: 1, name: 1 },
  publicFilter: { active: true },
  publicSort: { order: 1, name: 1 },
  searchableFields: ["name"],
});

const donationTypes = createCrudService(DonationType, {
  label: "Type de don",
  defaultSort: { order: 1, name: 1 },
  publicFilter: { active: true },
  publicSort: { order: 1, name: 1 },
  searchableFields: ["name"],
});
```

- [ ] **Step 2: Monter les deux ressources CRUD**

Près des autres appels à `mount(...)` (~ligne 405) :

```js
mount("payment-methods", paymentMethods, {
  publicBySlug: false,
  writeRoles: ["admin"],
  readRoles: ["admin", "editor"],
  auditResource: "paymentMethod",
});

mount("donation-types", donationTypes, {
  publicBySlug: false,
  writeRoles: ["admin"],
  readRoles: ["admin", "editor"],
  auditResource: "donationType",
});
```

- [ ] **Step 3: Remplacer intégralement la section « Dons »**

Remplacer tout le bloc allant de `// ---- Dons -----------------------------------------------------` jusqu'à `api.use("/admin/donations", adminDonations);` inclus (lignes ~1088 à 1299) par :

```js
  // ---- Dons -----------------------------------------------------
  //
  // Aucune route ne confirme automatiquement un paiement : le
  // donateur déclare un numéro de transaction Mobile Money, un
  // administrateur vérifie manuellement contre le relevé de l'église
  // avant de valider (voir donation.service.js#review). Voir la spec
  // pour le détail du parcours et des risques de fraude :
  // docs/superpowers/specs/2026-08-06-dons-mobile-money-design.md

  // Signature Cloudinary pour la preuve de paiement — même principe
  // que POST /uploads/signature (dossier "members") plus haut : le
  // dossier est imposé côté serveur, jamais lu depuis le corps de la
  // requête.
  api.post(
    "/donations/proof-signature",
    publicUploadLimiter,
    asyncHandler(async (_req, res) =>
      sendSuccess(res, {
        data: uploadService.createSignature({ folder: "donations" }),
      })
    )
  );

  api.post(
    "/donations",
    donationLimiter,
    asyncHandler(async (req, res) => {
      const data = await donationService.createDonation(req.body ?? {}, {
        ip: req.ip,
      });

      sendCreated(res, {
        message: "Votre don est enregistré, en attente de vérification.",
        data,
      });
    })
  );

  // Reçu au format PDF — uniquement pour un don validé (voir
  // donation.service.js#receiptFor). Pas d'authentification : la
  // référence, 64 bits d'aléa, tient lieu de clé.
  api.get(
    "/donations/:reference/recu",
    asyncHandler(async (req, res) => {
      const donation = await donationService.receiptFor(
        String(req.params.reference).slice(0, 40)
      );

      const pdf = await receiptService.buildReceipt(donation);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdf.length);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${receiptService.receiptFilename(donation)}"`
      );
      res.setHeader("Cache-Control", "private, max-age=3600");

      res.end(pdf);
    })
  );

  // ---- Dons : administration ------------------------------------
  const adminDonations = Router();

  // Données financières : un compte agent (soa/cana/coordinateur_
  // bergeries/pasteur) n'a rien à y faire.
  adminDonations.use(requireAuth, requireRole("admin", "editor"));

  adminDonations.get(
    "/",
    asyncHandler(async (req, res) => {
      const data = await donationService.adminList({
        status: req.query.status,
        donationType: req.query.donationType,
        paymentMethod: req.query.paymentMethod,
        limit: req.query.limit,
        page: req.query.page,
      });

      sendSuccess(res, {
        data: data.items,
        meta: { total: data.total, page: data.page, perPage: data.perPage },
      });
    })
  );

  adminDonations.get(
    "/summary",
    asyncHandler(async (_req, res) => {
      const summary = await donationService.adminSummary();

      sendSuccess(res, { data: summary });
    })
  );

  // Validation/rejet : réservé à `admin` strictement, un `editor` ne
  // décide jamais d'une écriture financière (voir la spec).
  adminDonations.post(
    "/:id/review",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = await donationService.review(
        req.params.id,
        { decision: req.body?.decision, note: req.body?.note },
        req.user
      );

      await audit.record(req, {
        action: "update",
        resource: "donation",
        resourceId: req.params.id,
      });

      sendSuccess(res, {
        message:
          data.status === "valide" ? "Don validé." : "Don rejeté.",
        data,
      });
    })
  );

  // QR code à projeter pendant un direct — conservé tel quel,
  // indépendant du prestataire de paiement.
  adminDonations.get(
    "/qrcode",
    asyncHandler(async (req, res) => {
      const params = new URLSearchParams();

      const type = String(req.query.type ?? "").trim();
      const amount = Number(req.query.amount);

      if (type) params.set("type", type.slice(0, 20));
      if (Number.isInteger(amount) && amount > 0) {
        params.set("amount", String(amount));
      }

      const query = params.toString();

      const url =
        `${donationService.publicSiteUrl()}/donate` +
        (query ? `?${query}` : "");

      const dataUrl = await QRCode.toDataURL(url, {
        width: 900,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0d5b3e", light: "#ffffff" },
      });

      const unreachable = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(
        url
      );

      sendSuccess(res, {
        data: {
          url,
          dataUrl,
          warning: unreachable
            ? "Ce QR code pointe vers une adresse locale, injoignable depuis un téléphone. " +
              "Renseignez PUBLIC_SITE_URL sur le serveur avant de le projeter."
            : null,
        },
      });
    })
  );

  api.use("/admin/donations", adminDonations);
```

- [ ] **Step 4: Ajouter les deux routes publiques `donation-types`/`payment-methods`**

Ces deux routes existent déjà automatiquement via `mount(...)` au Step 2 (`GET /api/donation-types`, `GET /api/payment-methods`, en lecture publique filtrée `active: true`) — aucun code additionnel nécessaire.

- [ ] **Step 5: Vérification manuelle**

```bash
cd backend && npm run dev
```

Dans un autre terminal :

```bash
curl http://localhost:4000/api/donation-types
curl http://localhost:4000/api/payment-methods
curl -X POST http://localhost:4000/api/donations -H "Content-Type: application/json" -d '{}'
```//
Expected: les deux premières renvoient `{"success":true,"data":[]}` (collections vides avant amorçage), la troisième renvoie une erreur 422 listant les champs manquants — la route répond, pas de 500.

- [ ] **Step 6: Lancer la suite de tests backend complète**

Run: `cd backend && npm test`
Expected: PASS (aucune régression sur les autres modules)

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/index.js
git commit -m "feat(dons): remplace les routes CinetPay par le parcours Mobile Money manuel"
```

---

## Task 7: Adapter `receipt.service.js`

**Files:**
- Modify: `backend/src/services/receipt.service.js`

**Interfaces:**
- Consumes: `Donation` tel que produit par Task 3 (`donation.donationType.name`, `donation.paymentMethod.name`, `donation.donor`, `donation.reference`, `donation.createdAt`).
- Produces: `buildReceipt(donation) -> Promise<Buffer>` (signature inchangée), `receiptFilename(donation) -> string` (inchangée).

- [ ] **Step 1: Retirer les tables de libellés devenues inutiles et adapter les champs**

Remplacer les lignes 93-116 (`TYPE_LABELS`, `PROJECT_LABELS`, `METHOD_LABELS`) — supprimées : les libellés sont maintenant directement sur le document (`donationType.name`, `paymentMethod.name`).

Remplacer `donorLine` (lignes 135-143) :

```js
const donorLine = (donation) => {
  const full = [donation.donor?.firstName, donation.donor?.lastName]
    .filter(Boolean)
    .join(" ");

  return full || "Non renseigné";
};
```

Remplacer la ligne `const verifyUrl = ...` (ligne 154) : le lien encodé dans le QR du reçu ne peut plus pointer vers `/donate/retour` (page supprimée, Task 15) ; il pointe directement vers l'API, qui régénère le PDF authentique à chaque scan :

```js
  const verifyUrl = `${env.PUBLIC_API_URL}/api/donations/${donation.reference}/recu`;
```

Remplacer le tableau `rows` (lignes 283-300) — retrait de la ligne « Affectation », les libellés viennent directement du document :

```js
  const rows = [
    ["Reçu de", donorLine(donation)],
    ["Date du don", formatDate(donation.createdAt)],
    ["Nature", donation.donationType?.name ?? "—"],
    ["Moyen de paiement", donation.paymentMethod?.name ?? "—"],
  ];
```

- [ ] **Step 2: Vérification manuelle**

Aucun test automatisé n'existe pour ce service (génération de PDF). Vérifier en déclenchant manuellement une fois le Task 13 (validation admin) en place : valider un don de test, puis ouvrir `GET /api/donations/<reference>/recu` dans un navigateur et contrôler visuellement que les champs « Nature » et « Moyen de paiement » affichent bien les libellés attendus, sans ligne « Affectation ».

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/receipt.service.js
git commit -m "feat(dons): adapte le reçu PDF au nouveau modèle de don"
```

---

## Task 8: Nettoyage CinetPay (env, fichier, .env.example)

**Files:**
- Modify: `backend/src/config/env.js`
- Modify: `backend/.env.example`
- Delete: `backend/src/services/payment/cinetpay.js`

**Interfaces:**
- Produces: `env` sans les clés `CINETPAY_*` ; suppression de `isPaymentConfigured`.

- [ ] **Step 1: Retirer les variables CinetPay de `env.js`**

Supprimer le bloc (lignes 105-120) :

```js
  // ---- Encaissement des dons (CinetPay) ------------------------
  ...
  CINETPAY_API_KEY: read("CINETPAY_API_KEY"),
  CINETPAY_SITE_ID: read("CINETPAY_SITE_ID"),
  CINETPAY_SECRET_KEY: read("CINETPAY_SECRET_KEY"),

  CINETPAY_BASE_URL:
    read("CINETPAY_BASE_URL") ?? "https://api-checkout.cinetpay.com/v2",
```

Supprimer le bloc de validation associé (lignes 202-244, "Encaissement des dons" jusqu'à la fin du `if (provided.length === paymentKeys.length) { ... }`).

Supprimer la fonction `isPaymentConfigured` (lignes 286-297).

- [ ] **Step 2: Retirer les entrées CinetPay de `.env.example`**

Rechercher et supprimer les lignes `CINETPAY_API_KEY=`, `CINETPAY_SITE_ID=`, `CINETPAY_SECRET_KEY=`, `CINETPAY_BASE_URL=` (et leur commentaire associé) dans `backend/.env.example`.

- [ ] **Step 3: Supprimer le fichier adaptateur**

```bash
git rm backend/src/services/payment/cinetpay.js
```

- [ ] **Step 4: Vérifier qu'aucune référence résiduelle ne subsiste**

Run: `cd backend && grep -rn "CINETPAY\|cinetpay\|isPaymentConfigured" src/`
Expected: aucun résultat

- [ ] **Step 5: Lancer la suite de tests backend et démarrer le serveur**

Run: `cd backend && npm test && npm run dev`
Expected: tests PASS, serveur démarre sans erreur de configuration

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/env.js backend/.env.example
git commit -m "chore(dons): retire la configuration CinetPay devenue inutile"
```

---

## Task 9: Amorçage des moyens de paiement et types de don

**Files:**
- Modify: `backend/src/scripts/seed-data.js`
- Modify: `backend/src/scripts/seed.js`

**Interfaces:**
- Consumes: `upsert` (déjà défini dans `seed.js`), `PaymentMethod`/`DonationType` (Task 1/2).
- Produces: 4 moyens de paiement (`active: false`, à compléter manuellement) et 6 types de don (`active: true`) amorcés en base, de façon idempotente.

- [ ] **Step 1: Ajouter les données d'amorçage**

Dans `backend/src/scripts/seed-data.js`, ajouter en fin de fichier :

```js
// ---- Moyens de paiement --------------------------------------------
// `active: false` volontairement : sans image QR ni numéro réels,
// aucun de ces moyens ne doit apparaître aux fidèles avant que
// l'administration ne les complète et ne les active.
export const seedPaymentMethods = [
  { name: "Orange Money", order: 1 },
  { name: "MTN Money", order: 2 },
  { name: "Moov Money", order: 3 },
  { name: "Wave", order: 4 },
];

// ---- Types de don ---------------------------------------------------
export const seedDonationTypes = [
  { name: "Dîme", order: 1 },
  { name: "Offrande", order: 2 },
  { name: "Action de grâce", order: 3 },
  { name: "Construction", order: 4 },
  { name: "Mission", order: 5 },
  { name: "Don libre", order: 6 },
];
```

- [ ] **Step 2: Brancher l'amorçage dans `seed.js`**

Ajouter les imports :

```js
import PaymentMethod from "../models/PaymentMethod.js";
import DonationType from "../models/DonationType.js";

import {
  seedEvents,
  seedMinistries,
  seedMedias,
  seedPaymentMethods,
  seedDonationTypes,
} from "./seed-data.js";
```

Après `await upsert(Media, ...)` :

```js
  await upsert(
    PaymentMethod,
    ["name"],
    seedPaymentMethods,
    "moyens de paiement"
  );
  await upsert(
    DonationType,
    ["name"],
    seedDonationTypes,
    "types de don"
  );
```

- [ ] **Step 3: Vérification manuelle**

```bash
cd backend && npm run seed
```

Expected: la sortie liste `moyens de paiement   4 créé(s), 0 déjà présent(s)` et `types de don   6 créé(s), 0 déjà présent(s)` (ou `0 créé(s), N déjà présent(s)` si relancé).

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/seed-data.js backend/src/scripts/seed.js
git commit -m "feat(dons): amorce les moyens de paiement et types de don par défaut"
```

---

## Task 10: Refonte de `contributionReducer.js`

**Files:**
- Modify: `src/context/contributionReducer.js` (remplacement intégral)
- Create: `src/context/contributionReducer.test.js`

**Interfaces:**
- Produces: `initialState`, `contributionReducer(state, action)` avec les actions `SET_AMOUNT`, `SET_DONATION_TYPE`, `SET_PAYMENT_METHOD`, `UPDATE_DONOR`, `SET_TRANSACTION_ID`, `SET_PROOF_IMAGE`, `RESET`. État : `{ amount, donationType: {id, name}, paymentMethod: {id, name, image}, donor: {firstName, lastName, phone, email}, proof: {transactionId, imageUrl} }`.

- [ ] **Step 1: Write the failing test**

```js
// src/context/contributionReducer.test.js
import { describe, it, expect } from "vitest";

import { contributionReducer, initialState } from "./contributionReducer";

describe("contributionReducer", () => {
  it("met à jour le montant en le convertissant en nombre", () => {
    const state = contributionReducer(initialState, {
      type: "SET_AMOUNT",
      payload: "15000",
    });

    expect(state.amount).toBe(15000);
  });

  it("enregistre le type de don choisi (id + nom)", () => {
    const state = contributionReducer(initialState, {
      type: "SET_DONATION_TYPE",
      payload: { id: "abc", name: "Dîme" },
    });

    expect(state.donationType).toEqual({ id: "abc", name: "Dîme" });
  });

  it("enregistre le moyen de paiement choisi (id + nom + image)", () => {
    const state = contributionReducer(initialState, {
      type: "SET_PAYMENT_METHOD",
      payload: { id: "xyz", name: "Orange Money", image: "https://x/y.png" },
    });

    expect(state.paymentMethod).toEqual({
      id: "xyz",
      name: "Orange Money",
      image: "https://x/y.png",
    });
  });

  it("fusionne les champs du donateur sans écraser les autres", () => {
    let state = contributionReducer(initialState, {
      type: "UPDATE_DONOR",
      payload: { firstName: "Awa" },
    });

    state = contributionReducer(state, {
      type: "UPDATE_DONOR",
      payload: { phone: "0700000000" },
    });

    expect(state.donor.firstName).toBe("Awa");
    expect(state.donor.phone).toBe("0700000000");
  });

  it("enregistre le numéro de transaction et l'image de preuve séparément", () => {
    let state = contributionReducer(initialState, {
      type: "SET_TRANSACTION_ID",
      payload: "MP240101.1234.A1",
    });

    state = contributionReducer(state, {
      type: "SET_PROOF_IMAGE",
      payload: "https://res.cloudinary.com/x/y.png",
    });

    expect(state.proof).toEqual({
      transactionId: "MP240101.1234.A1",
      imageUrl: "https://res.cloudinary.com/x/y.png",
    });
  });

  it("RESET revient à l'état initial", () => {
    const changed = contributionReducer(initialState, {
      type: "SET_AMOUNT",
      payload: 99999,
    });

    expect(contributionReducer(changed, { type: "RESET" })).toEqual(
      initialState
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/context/contributionReducer.test.js`
Expected: FAIL — l'état actuel n'a ni `donationType`, ni `proof`, et les actions `SET_TYPE`/`SET_PROJECT`/`SET_RECURRING` n'existent plus dans le nouveau contrat

- [ ] **Step 3: Write minimal implementation**

```js
// src/context/contributionReducer.js
import { createContext } from "react";

// Séparé de ContributionContext.jsx et useContribution.js : aucun des
// deux ne doit exporter autre chose qu'un composant, sous peine de
// désactiver le Fast Refresh de Vite sur tout le fichier (règle
// ESLint react-refresh/only-export-components).
export const ContributionContext = createContext();

export const initialState = {
  amount: 10000,

  // `{ id: "", name: "" }` tant que la liste n'a pas encore répondu
  // (voir StepIdentity) — un id vide bloque la validation de l'étape,
  // pas de valeur par défaut arbitraire comme dans l'ancien tunnel.
  donationType: { id: "", name: "" },

  paymentMethod: { id: "", name: "", image: "" },

  donor: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  },

  proof: {
    transactionId: "",
    imageUrl: "",
  },
};

export function contributionReducer(state, action) {
  switch (action.type) {
    case "SET_AMOUNT":
      return {
        ...state,
        amount: Number(action.payload),
      };

    case "SET_DONATION_TYPE":
      return {
        ...state,
        donationType: action.payload,
      };

    case "SET_PAYMENT_METHOD":
      return {
        ...state,
        paymentMethod: action.payload,
      };

    case "UPDATE_DONOR":
      return {
        ...state,
        donor: {
          ...state.donor,
          ...action.payload,
        },
      };

    case "SET_TRANSACTION_ID":
      return {
        ...state,
        proof: {
          ...state.proof,
          transactionId: action.payload,
        },
      };

    case "SET_PROOF_IMAGE":
      return {
        ...state,
        proof: {
          ...state.proof,
          imageUrl: action.payload,
        },
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/context/contributionReducer.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/context/contributionReducer.js src/context/contributionReducer.test.js
git commit -m "feat(dons): refonte de l'état du tunnel de contribution"
```

---

## Task 11: `data.js` — retrait des données codées en dur, nouvelle validation

**Files:**
- Modify: `src/components/donate/ContributionForm/data.js` (remplacement intégral)

**Interfaces:**
- Consumes: rien.
- Produces: `amounts` (suggestions de montant, inchangé), `steps` (4 libellés), `validateStep(step, state) -> string`.

- [ ] **Step 1: Remplacer le fichier**

```js
// src/components/donate/ContributionForm/data.js
//
// Types de don et moyens de paiement viennent désormais de l'API
// (voir services/donations.js) — ce fichier ne porte plus que les
// montants suggérés, les libellés d'étapes et la validation.

export const amounts = [5000, 10000, 20000, 50000, 100000];

// Chaque étape correspond à une étape réelle de la démarche du
// donateur (identité → moyen → paiement → preuve), pas à une
// numérotation arbitraire — voir la section « Design visuel » de la
// spec.
export const steps = [
  "Vos informations",
  "Moyen de paiement",
  "Paiement",
  "Preuve",
];

export const validateStep = (step, state) => {
  if (step === 0) {
    if (!state.donor.firstName.trim()) {
      return "Merci d'indiquer votre prénom.";
    }

    if (!state.donor.lastName.trim()) {
      return "Merci d'indiquer votre nom.";
    }

    if (!state.donor.phone.trim()) {
      return "Merci d'indiquer un numéro de téléphone.";
    }

    if (!state.donationType.id) {
      return "Merci de choisir un type de don.";
    }

    if (!state.amount || state.amount <= 0) {
      return "Merci d'indiquer un montant supérieur à zéro.";
    }
  }

  if (step === 1 && !state.paymentMethod.id) {
    return "Merci de choisir un moyen de paiement.";
  }

  if (step === 3) {
    if (!state.proof.transactionId.trim()) {
      return "Merci de saisir le numéro de transaction reçu par SMS après votre paiement.";
    }
  }

  return "";
};
```

- [ ] **Step 2: Vérification**

Ce fichier n'a pas de test dédié (comme avant la refonte) — sa correction est couverte par `ContributionForm.test.jsx` (Task 16). Passer directement au Task suivant.

- [ ] **Step 3: Commit**

```bash
git add src/components/donate/ContributionForm/data.js
git commit -m "feat(dons): data.js du tunnel adapté au parcours à 4 étapes"
```

---

## Task 12: Services frontend — `donations.js` et `uploads.js`

**Files:**
- Modify: `src/services/donations.js` (remplacement intégral)
- Modify: `src/services/uploads.js` (ajout d'une fonction)
- Modify: `src/services/api.js` (ajout de deux collections admin)

**Interfaces:**
- Produces (`donations.js`) :
  - `fetchDonationTypes() -> Promise<Array<{id, name, description}>>`
  - `fetchPaymentMethods() -> Promise<Array<{id, name, image: {url}, accountNumber, holderName}>>`
  - `submitDonation(payload) -> Promise<{reference, status}>`
  - `fetchReceipt(reference) -> Promise<{blob, filename}>` (conservée)
  - `adminDonations(params) -> Promise<{items, meta}>`
  - `adminDonationSummary() -> Promise<object>`
  - `reviewDonation(id, decision, note) -> Promise<object>`
  - `adminDonationQrCode(params) -> Promise<object>` (conservée)
- Produces (`uploads.js`) : `uploadDonationProof(file, options) -> Promise<{url, publicId}>`
- Produces (`api.js`) : `paymentMethods`, `donationTypes` (collections génériques admin, même contrat que `testimonials`)

- [ ] **Step 1: Réécrire `donations.js`**

```js
// src/services/donations.js
import { request, requestWithMeta } from "./http";

// Accès à la chaîne de dons.
//
// Aucune fonction ici ne confirme un paiement : le don est créé avec
// la preuve (numéro de transaction, éventuellement une image) déjà
// fournie par le donateur, et reste `en_attente` jusqu'à la
// vérification manuelle d'un administrateur (voir DonationsAdmin).

export const fetchDonationTypes = () => request("/api/donation-types");

export const fetchPaymentMethods = () => request("/api/payment-methods");

export const submitDonation = (payload) =>
  request("/api/donations", { method: "POST", body: payload });

// ---- Reçu ----------------------------------------------------------
// Le PDF est récupéré en binaire plutôt que lié directement : l'API et
// le site sont sur deux domaines distincts, et l'attribut `download`
// d'un lien est ignoré pour une URL d'une autre origine.
export const fetchReceipt = async (reference) => {
  const base = (
    import.meta.env.VITE_API_URL ?? "http://localhost:4000"
  ).replace(/\/+$/, "");

  const response = await fetch(
    `${base}/api/donations/${encodeURIComponent(reference)}/recu`
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(payload?.message ?? "Le reçu n'a pas pu être généré.");
  }

  return {
    blob: await response.blob(),
    filename: `recu-cava-${reference}.pdf`,
  };
};

// ---- Administration ----------------------------------------------

export const adminDonations = (params = {}) =>
  requestWithMeta(`/api/admin/donations?${new URLSearchParams(params)}`, {
    auth: true,
  });

export const adminDonationSummary = () =>
  request("/api/admin/donations/summary", { auth: true });

export const reviewDonation = (id, decision, note) =>
  request(`/api/admin/donations/${id}/review`, {
    method: "POST",
    body: { decision, note },
    auth: true,
  });

export const adminDonationQrCode = (params = {}) =>
  request(`/api/admin/donations/qrcode?${new URLSearchParams(params)}`, {
    auth: true,
  });
```

- [ ] **Step 2: Ajouter `uploadDonationProof` dans `uploads.js`**

Après `uploadMemberPhoto` (fin du fichier) :

```js
/**
 * Envoi de la capture/photo de preuve depuis le formulaire PUBLIC de
 * don — même principe que `uploadMemberPhoto` : route de signature
 * dédiée et sans authentification, dossier imposé côté serveur.
 */
export const uploadDonationProof = (file, { onProgress, signal } = {}) =>
  uploadFile(file, {
    folder: "donations",
    accept: "image",
    onProgress,
    signal,
    signaturePath: "/api/donations/proof-signature",
    auth: false,
  });
```

- [ ] **Step 3: Ajouter les deux collections admin dans `api.js`**

Après `export const churches = collection("churches");` :

```js
export const paymentMethods = collection("payment-methods");
export const donationTypes = collection("donation-types");
```

- [ ] **Step 4: Vérification manuelle**

```bash
npm run build
```

Expected: build réussi, aucune erreur d'import.

- [ ] **Step 5: Commit**

```bash
git add src/services/donations.js src/services/uploads.js src/services/api.js
git commit -m "feat(dons): services frontend pour le parcours de don Mobile Money"
```

---

## Task 13: `StepIdentity.jsx` — identité, montant, type de don

**Files:**
- Create: `src/components/donate/ContributionForm/StepIdentity.jsx`

**Interfaces:**
- Consumes: `useAsyncData` (`src/hooks/useAsyncData.js`), `fetchDonationTypes` (Task 12), `amounts` (Task 11), état/`dispatch` du reducer (Task 10).
- Produces: composant `StepIdentity({ state, dispatch, updateDonor, onEdit })`.

- [ ] **Step 1: Écrire le composant**

```jsx
// src/components/donate/ContributionForm/StepIdentity.jsx
import { Sprout } from "lucide-react";

import useAsyncData from "../../../hooks/useAsyncData";
import { fetchDonationTypes } from "../../../services/donations";

import { amounts } from "./data";

const fields = [
  { key: "firstName", label: "Prénom", autoComplete: "given-name", type: "text" },
  { key: "lastName", label: "Nom", autoComplete: "family-name", type: "text" },
  { key: "phone", label: "Téléphone", autoComplete: "tel", type: "tel" },
  { key: "email", label: "Email (optionnel)", autoComplete: "email", type: "email" },
];

// Étape 1 : coordonnées, montant, type de don — la « semence » du
// parcours (voir la section Design visuel de la spec).
const StepIdentity = ({ state, dispatch, updateDonor, onEdit }) => {
  const { data: types, loading, error } = useAsyncData(fetchDonationTypes);

  return (
    <div className="step-panel">

      <div className="form-group">
        <label>Vos informations</label>

        <div className="donor-grid">
          {fields.map((field) => (
            <input
              key={field.key}
              type={field.type}
              placeholder={field.label}
              aria-label={field.label}
              autoComplete={field.autoComplete}
              value={state.donor[field.key]}
              onChange={(e) => updateDonor(field.key, e.target.value)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="donation-type">Type de don</label>

        {loading && <p className="step-panel__hint">Chargement des types de don…</p>}
        {error && <p className="step-panel__hint step-panel__hint--error">{error}</p>}

        {types && (
          <select
            id="donation-type"
            value={state.donationType.id}
            onChange={(e) => {
              const chosen = types.find((t) => t.id === e.target.value);

              dispatch({
                type: "SET_DONATION_TYPE",
                payload: chosen ? { id: chosen.id, name: chosen.name } : { id: "", name: "" },
              });
            }}
          >
            <option value="">Choisir un type de don</option>

            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="form-group">
        <label id="label-montant" htmlFor="montant-libre">
          Montant
        </label>

        <div className="amount-grid" role="group" aria-labelledby="label-montant">
          {amounts.map((amount) => (
            <button
              type="button"
              key={amount}
              className={state.amount === amount ? "active" : ""}
              aria-pressed={state.amount === amount}
              onClick={() => dispatch({ type: "SET_AMOUNT", payload: amount })}
            >
              {amount.toLocaleString()}
            </button>
          ))}
        </div>

        <input
          id="montant-libre"
          type="number"
          min="0"
          value={state.amount}
          placeholder="Autre montant"
          onChange={(e) => {
            dispatch({ type: "SET_AMOUNT", payload: e.target.value });
            onEdit();
          }}
        />
      </div>

      <p className="step-panel__growth-hint">
        <Sprout size={15} aria-hidden="true" />
        Comme une semence, votre don grandit — choisissez ensuite comment le faire parvenir.
      </p>

    </div>
  );
};

export default StepIdentity;
```

- [ ] **Step 2: Vérification**

Couvert par le test d'orchestration `ContributionForm.test.jsx` (Task 16). Pas de test unitaire isolé pour ce composant — aligné sur le précédent du projet (`RegistrationForm` ne teste que l'orchestrateur, pas chaque `Step*` individuellement).

- [ ] **Step 3: Commit**

```bash
git add src/components/donate/ContributionForm/StepIdentity.jsx
git commit -m "feat(dons): étape identité/montant/type du tunnel de don"
```

---

## Task 14: `StepPaymentMethod.jsx` — choix du moyen de paiement

**Files:**
- Create: `src/components/donate/ContributionForm/StepPaymentMethod.jsx`

**Interfaces:**
- Consumes: `useAsyncData`, `fetchPaymentMethods` (Task 12).
- Produces: composant `StepPaymentMethod({ state, dispatch })`.

- [ ] **Step 1: Écrire le composant**

```jsx
// src/components/donate/ContributionForm/StepPaymentMethod.jsx
import useAsyncData from "../../../hooks/useAsyncData";
import { fetchPaymentMethods } from "../../../services/donations";

// Étape 2 : choix du moyen de paiement — la « pousse » du parcours.
const StepPaymentMethod = ({ state, dispatch }) => {
  const { data: methods, loading, error } = useAsyncData(fetchPaymentMethods);

  return (
    <div className="step-panel">

      <div className="form-group">
        <label id="label-paiement">Moyen de paiement</label>

        {loading && <p className="step-panel__hint">Chargement des moyens de paiement…</p>}
        {error && <p className="step-panel__hint step-panel__hint--error">{error}</p>}

        {methods && methods.length === 0 && (
          <p className="step-panel__hint step-panel__hint--error">
            Aucun moyen de paiement n'est actif pour le moment. Merci de nous contacter directement.
          </p>
        )}

        {methods && methods.length > 0 && (
          <div className="payment-grid" role="group" aria-labelledby="label-paiement">
            {methods.map((method) => (
              <button
                type="button"
                key={method.id}
                className={state.paymentMethod.id === method.id ? "active" : ""}
                aria-pressed={state.paymentMethod.id === method.id}
                onClick={() =>
                  dispatch({
                    type: "SET_PAYMENT_METHOD",
                    payload: {
                      id: method.id,
                      name: method.name,
                      image: method.image?.url ?? "",
                    },
                  })
                }
              >
                <div className="payment-logo-wrapper">
                  {method.image?.url && (
                    <img src={method.image.url} alt="" aria-hidden="true" className="payment-logo" />
                  )}
                </div>

                <span>{method.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default StepPaymentMethod;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/donate/ContributionForm/StepPaymentMethod.jsx
git commit -m "feat(dons): étape moyen de paiement du tunnel de don"
```

---

## Task 15: `StepQrTicket.jsx` — le billet d'offrande numérique (signature visuelle)

**Files:**
- Create: `src/components/donate/ContributionForm/StepQrTicket.jsx`

**Interfaces:**
- Consumes: `state.amount`, `state.donationType.name`, `state.paymentMethod.{name, image}`, `state.donor.firstName/lastName`.
- Produces: composant `StepQrTicket({ state })` — pas de `dispatch`, purement présentationnel ; le passage à l'étape suivante reste porté par le bouton « J'ai effectué le paiement » du bas de tunnel (`ContributionForm/index.jsx`, Task 17).

- [ ] **Step 1: Écrire le composant**

```jsx
// src/components/donate/ContributionForm/StepQrTicket.jsx
import { Leaf } from "lucide-react";

// Étape 3 : le QR à scanner, mis en forme comme un billet d'offrande
// numérique — enveloppe d'offrande physique réinventée (voir la
// section Design visuel de la spec). Composant purement
// présentationnel : la navigation reste gérée par l'orchestrateur.
const StepQrTicket = ({ state }) => {
  const amount = Number(state.amount || 0).toLocaleString("fr-FR");
  const donorName = [state.donor.firstName, state.donor.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="step-panel">

      <div className="offering-ticket">

        <div className="offering-ticket__notch offering-ticket__notch--left" aria-hidden="true" />
        <div className="offering-ticket__notch offering-ticket__notch--right" aria-hidden="true" />

        <p className="offering-ticket__eyebrow">
          <Leaf size={14} aria-hidden="true" />
          Scannez pour donner
        </p>

        <div className="offering-ticket__qr">
          {state.paymentMethod.image ? (
            <img src={state.paymentMethod.image} alt={`QR code ${state.paymentMethod.name}`} />
          ) : (
            <p className="offering-ticket__qr-missing">
              QR indisponible pour ce moyen de paiement.
            </p>
          )}
        </div>

        <p className="offering-ticket__amount">{amount} F CFA</p>

        <dl className="offering-ticket__details">
          <div>
            <dt>Donateur</dt>
            <dd>{donorName || "—"}</dd>
          </div>
          <div>
            <dt>Type de don</dt>
            <dd>{state.donationType.name || "—"}</dd>
          </div>
          <div>
            <dt>Moyen</dt>
            <dd>{state.paymentMethod.name || "—"}</dd>
          </div>
        </dl>

      </div>

      <p className="step-panel__hint">
        Ouvrez votre application {state.paymentMethod.name || "Mobile Money"}, scannez ce code
        et réglez le montant ci-dessus. Une fois le paiement effectué, passez à l'étape suivante.
      </p>

    </div>
  );
};

export default StepQrTicket;
```

- [ ] **Step 2: Ajouter les styles du billet dans `ContributionForm.scss`**

Ajouter, imbriqué sous la classe racine `.contribution-form` existante (jamais à la racine du fichier — voir le piège documenté dans `CLAUDE.md`) :

```scss
.contribution-form {
  // Tokens visuels du module, scopés ici pour ne jamais fuiter sur le
  // reste du site (voir CLAUDE.md — piège des classes SCSS globales).
  --sowing-green: #0d7e58;
  --harvest-gold: #f4c61d;
  --deep-canopy: #08321f;
  --linen: #fbf9f4;
  --sage-mist: #eaf3ee;

  // ... styles existants conservés ...

  .offering-ticket {
    position: relative;
    background: linear-gradient(155deg, var(--deep-canopy), var(--sowing-green));
    border-radius: 24px;
    padding: 32px 28px;
    color: #fff;
    text-align: center;
    box-shadow:
      0 2px 6px rgba(8, 50, 31, 0.25),
      0 18px 40px rgba(8, 50, 31, 0.35);
    border: 1px dashed rgba(255, 255, 255, 0.35);

    &__notch {
      position: absolute;
      top: 50%;
      width: 22px;
      height: 22px;
      background: var(--linen);
      border-radius: 50%;
      transform: translateY(-50%);

      &--left { left: -11px; }
      &--right { right: -11px; }
    }

    &__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--harvest-gold);
      margin: 0 0 18px;
    }

    &__qr {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 180px;

      img {
        width: 180px;
        height: 180px;
        object-fit: contain;
      }
    }

    &__qr-missing {
      color: var(--deep-canopy);
      font-size: 0.85rem;
      max-width: 160px;
    }

    &__amount {
      font-family: "Fraunces", serif;
      font-size: 2.4rem;
      color: var(--harvest-gold);
      margin: 20px 0 12px;
    }

    &__details {
      display: grid;
      gap: 8px;
      text-align: left;
      border-top: 1px dashed rgba(255, 255, 255, 0.35);
      padding-top: 16px;
      margin: 0;

      div {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
      }

      dt { color: rgba(255, 255, 255, 0.7); }
      dd { margin: 0; font-weight: 600; }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/donate/ContributionForm/StepQrTicket.jsx src/components/donate/ContributionForm/ContributionForm.scss
git commit -m "feat(dons): billet d'offrande numérique (étape QR à scanner)"
```

---

## Task 16: `StepProof.jsx` — numéro de transaction et capture optionnelle

**Files:**
- Create: `src/components/donate/ContributionForm/StepProof.jsx`

**Interfaces:**
- Consumes: `uploadDonationProof` (Task 12), `dispatch` (`SET_TRANSACTION_ID`, `SET_PROOF_IMAGE`).
- Produces: composant `StepProof({ state, dispatch })`.

- [ ] **Step 1: Écrire le composant**

```jsx
// src/components/donate/ContributionForm/StepProof.jsx
import { useState } from "react";

import { Wheat, Loader2, Image as ImageIcon, X } from "lucide-react";

import { uploadDonationProof } from "../../../services/uploads";

// Étape 4 : la preuve — l'« épi » du parcours. Le numéro de
// transaction est obligatoire (propre à chaque opération, donc
// difficile à rejouer) ; la capture d'écran reste un complément
// optionnel (voir la spec : une capture seule peut être une ancienne
// capture réutilisée).
const StepProof = ({ state, dispatch }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const { url } = await uploadDonationProof(file);

      dispatch({ type: "SET_PROOF_IMAGE", payload: url });
    } catch (error) {
      setUploadError(error.message ?? "L'envoi de l'image a échoué.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="step-panel">

      <div className="form-group">
        <label htmlFor="transaction-id">Numéro de transaction Mobile Money</label>

        <input
          id="transaction-id"
          type="text"
          placeholder="Reçu par SMS après votre paiement"
          value={state.proof.transactionId}
          onChange={(e) =>
            dispatch({ type: "SET_TRANSACTION_ID", payload: e.target.value })
          }
        />

        <p className="step-panel__hint">
          Ce numéro nous permet de vérifier votre paiement auprès de notre relevé Mobile Money.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="proof-image">Capture ou photo du reçu (optionnel)</label>

        {!state.proof.imageUrl && (
          <label className="proof-upload">
            {uploading ? (
              <>
                <Loader2 className="proof-upload__spin" size={18} aria-hidden="true" />
                Envoi en cours…
              </>
            ) : (
              <>
                <ImageIcon size={18} aria-hidden="true" />
                Ajouter une image
              </>
            )}

            <input
              id="proof-image"
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
        )}

        {state.proof.imageUrl && (
          <div className="proof-preview">
            <img src={state.proof.imageUrl} alt="Aperçu de la preuve envoyée" />

            <button
              type="button"
              className="proof-preview__remove"
              onClick={() => dispatch({ type: "SET_PROOF_IMAGE", payload: "" })}
            >
              <X size={14} aria-hidden="true" />
              Retirer
            </button>
          </div>
        )}

        {uploadError && (
          <p className="step-panel__hint step-panel__hint--error">{uploadError}</p>
        )}
      </div>

      <p className="step-panel__growth-hint">
        <Wheat size={15} aria-hidden="true" />
        Dernière étape avant la récolte : envoyez votre don pour vérification.
      </p>

    </div>
  );
};

export default StepProof;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/donate/ContributionForm/StepProof.jsx
git commit -m "feat(dons): étape preuve (numéro de transaction + capture optionnelle)"
```

---

## Task 17: `SummaryCard.jsx` et `index.jsx` — orchestration à 4 étapes

**Files:**
- Modify: `src/components/donate/ContributionForm/SummaryCard.jsx` (remplacement intégral)
- Modify: `src/components/donate/ContributionForm/index.jsx` (remplacement intégral)

**Interfaces:**
- Consumes: `steps`, `validateStep` (Task 11), `submitDonation` (Task 12), `StepIdentity`/`StepPaymentMethod`/`StepQrTicket`/`StepProof` (Task 13-16), icônes de croissance `lucide-react` (`Sprout`, `Leaf`, `Wheat`, `Check`).
- Produces: `ContributionForm` (export par défaut, remplace le composant existant, même point de montage).

- [ ] **Step 1: Réécrire `SummaryCard.jsx`**

```jsx
// src/components/donate/ContributionForm/SummaryCard.jsx
import { ArrowRight, Loader2 } from "lucide-react";

import ImpactCard from "../ImpactSection";

// Récapitulatif collant, visible à toutes les étapes. Le bouton final
// ("J'ai effectué le paiement") n'apparaît qu'à l'étape du billet.
const SummaryCard = ({ state, step, submitting, submitError, onProceedToProof }) => {
  const amount = Number(state.amount || 0).toLocaleString("fr-FR");
  const showTicketAction = step === 2;

  return (
    <aside className="summary-card">

      <h3>Résumé</h3>

      <div className="summary-row">
        <span>Type</span>
        <strong>{state.donationType.name || "—"}</strong>
      </div>

      <div className="summary-row">
        <span>Paiement</span>
        <strong>{state.paymentMethod.name || "—"}</strong>
      </div>

      <div className="summary-total">
        <span>Total</span>
        <strong>{amount} FCFA</strong>
      </div>

      <ImpactCard />

      {showTicketAction && (
        <>
          <button
            type="button"
            className="pay-btn"
            onClick={onProceedToProof}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="pay-btn__spinner" aria-hidden="true" />
            ) : (
              <>
                J'ai effectué le paiement
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </button>

          {submitError && (
            <p className="step-error" role="alert">{submitError}</p>
          )}
        </>
      )}

    </aside>
  );
};

export default SummaryCard;
```

- [ ] **Step 2: Réécrire `index.jsx`**

```jsx
// src/components/donate/ContributionForm/index.jsx
import { useState } from "react";

import { ArrowLeft, ArrowRight, Check, Sprout, Leaf, Wheat, Send, Loader2 } from "lucide-react";

import { useContribution } from "../../../context/useContribution";

import { steps, validateStep } from "./data";
import { submitDonation } from "../../../services/donations";

import StepIdentity from "./StepIdentity";
import StepPaymentMethod from "./StepPaymentMethod";
import StepQrTicket from "./StepQrTicket";
import StepProof from "./StepProof";
import SummaryCard from "./SummaryCard";

import "./ContributionForm.scss";

// Icônes de croissance associées à chaque étape — écho au nom « Vie
// et Abondance » et à l'image biblique de la semence (voir la
// section Design visuel de la spec), pas une simple numérotation.
const STEP_ICONS = [Sprout, Leaf, Leaf, Wheat];

// Ce composant ne porte plus que l'orchestration du tunnel à 4
// étapes : identité/montant/type → moyen de paiement → QR à scanner
// → preuve. Aucune redirection externe : le don est créé directement
// depuis l'étape 4, avec la preuve déjà fournie.
const ContributionForm = () => {
  const { state, dispatch } = useContribution();

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reference, setReference] = useState("");

  const isLastStep = step === steps.length - 1;

  const clearError = () => {
    if (error) setError("");
  };

  const updateDonor = (field, value) => {
    dispatch({ type: "UPDATE_DONOR", payload: { [field]: value } });
    clearError();
  };

  const goNext = () => {
    const message = validateStep(step, state);

    if (message) {
      setError(message);
      return;
    }

    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  // Depuis l'étape « QR à scanner », le bouton « J'ai effectué le
  // paiement » avance simplement vers l'étape preuve — aucun appel
  // réseau ici, la création du don n'a lieu qu'à la soumission finale.
  const handleProceedToProof = () => goNext();

  const handleSubmit = async () => {
    const message = validateStep(step, state);

    if (message) {
      setError(message);
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      const result = await submitDonation({
        donor: state.donor,
        amount: state.amount,
        donationTypeId: state.donationType.id,
        paymentMethodId: state.paymentMethod.id,
        proof: state.proof,
      });

      setReference(result.reference);
    } catch (caught) {
      const details = caught.details ? Object.values(caught.details)[0] : null;

      setSubmitError(
        details ?? caught.message ?? "Votre don n'a pas pu être enregistré. Merci de réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <section className="contribution-form contribution-form--done" id="contribution-form">
        <div className="contribution-form__confirmation">
          <Check size={40} aria-hidden="true" />
          <h2>Merci pour votre don !</h2>
          <p>
            Votre contribution est enregistrée et en attente de vérification. Conservez votre
            référence : <strong>{reference}</strong>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="contribution-form" id="contribution-form">

      <div className="contribution-form__container">

        <div className="contribution-form__left">

          <h2>Votre contribution</h2>

          <ol className="steps" aria-label="Étapes du don">
            {steps.map((label, index) => {
              const Icon = STEP_ICONS[index];

              return (
                <li
                  key={label}
                  className={
                    index === step
                      ? "steps__item steps__item--current"
                      : index < step
                        ? "steps__item steps__item--done"
                        : "steps__item"
                  }
                  aria-current={index === step ? "step" : undefined}
                >
                  <span className="steps__bullet">
                    {index < step ? <Check aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                  </span>

                  <span className="steps__label">{label}</span>
                </li>
              );
            })}
          </ol>

          {step === 0 && (
            <StepIdentity state={state} dispatch={dispatch} updateDonor={updateDonor} onEdit={clearError} />
          )}

          {step === 1 && <StepPaymentMethod state={state} dispatch={dispatch} />}

          {step === 2 && <StepQrTicket state={state} />}

          {step === 3 && <StepProof state={state} dispatch={dispatch} />}

          {error && (
            <p className="step-error" role="alert">{error}</p>
          )}

          <div className="step-nav">

            {step > 0 && (
              <button type="button" className="step-nav__back" onClick={goBack}>
                <ArrowLeft aria-hidden="true" />
                Retour
              </button>
            )}

            {!isLastStep && step !== 2 && (
              <button type="button" className="step-nav__next" onClick={goNext}>
                Suivant
                <ArrowRight aria-hidden="true" />
              </button>
            )}

            {isLastStep && (
              <button
                type="button"
                className="step-nav__next"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 aria-hidden="true" />
                ) : (
                  <>
                    Envoyer
                    <Send aria-hidden="true" />
                  </>
                )}
              </button>
            )}

          </div>

        </div>

        <SummaryCard
          state={state}
          step={step}
          submitting={submitting}
          submitError={submitError}
          onProceedToProof={handleProceedToProof}
        />

      </div>

    </section>
  );
};

export default ContributionForm;
```

- [ ] **Step 3: Write the orchestrator test**

```jsx
// src/components/donate/ContributionForm/ContributionForm.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ContributionProvider } from "../../../context/ContributionContext";
import ContributionForm from "./index";

vi.mock("../../../services/donations", () => ({
  fetchDonationTypes: vi.fn().mockResolvedValue([
    { id: "type-1", name: "Dîme" },
  ]),
  fetchPaymentMethods: vi.fn().mockResolvedValue([
    { id: "method-1", name: "Orange Money", image: { url: "" } },
  ]),
  submitDonation: vi.fn().mockResolvedValue({ reference: "CAVA-TEST1234", status: "en_attente" }),
}));

const renderForm = () =>
  render(
    <ContributionProvider>
      <ContributionForm />
    </ContributionProvider>
  );

describe("ContributionForm (orchestrateur)", () => {
  it("affiche la première étape (Vos informations) au départ", () => {
    renderForm();

    expect(
      screen.getByRole("list", { name: /étapes du don/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
  });

  it("bloque le passage à l'étape suivante quand un champ obligatoire manque", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    expect(screen.getByText(/merci d'indiquer votre prénom/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
  });

  it("avance jusqu'à l'étape preuve une fois les champs remplis", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Awa" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Traoré" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "0700000000" } });

    await waitFor(() =>
      expect(screen.getByLabelText("Type de don")).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText("Type de don"), { target: { value: "type-1" } });

    fireEvent.click(screen.getByRole("button", { name: /suivant/i }));

    await waitFor(() =>
      expect(screen.getByText(/moyen de paiement/i)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/donate/ContributionForm/ContributionForm.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/donate/ContributionForm/SummaryCard.jsx src/components/donate/ContributionForm/index.jsx src/components/donate/ContributionForm/ContributionForm.test.jsx
git commit -m "feat(dons): orchestration du tunnel de don à 4 étapes"
```

---

## Task 18: Tokens visuels globaux — police Fraunces

**Files:**
- Modify: `index.html`

**Interfaces:** aucune (chargement de police uniquement).

- [ ] **Step 1: Ajouter la police Fraunces à côté de Poppins**

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet">
```

(Remplace la ligne `<link href="https://fonts.googleapis.com/css2?family=Poppins...">` existante par cette version combinée — une seule requête Google Fonts au lieu de deux.)

- [ ] **Step 2: Vérification manuelle**

```bash
npm run dev
```

Ouvrir `/donate` dans un navigateur, avancer jusqu'à l'étape 3 (billet), vérifier au DevTools que la police du montant (`.offering-ticket__amount`) est bien rendue en Fraunces (network : la requête `fonts.googleapis.com` inclut `Fraunces` et se charge sans erreur 404).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(dons): charge la police Fraunces pour le billet d'offrande"
```

---

## Task 19: Nettoyage — suppression de `DonationReturn` et `ReceiptActions`

**Files:**
- Delete: `src/pages/DonationReturn/` (dossier)
- Delete: `src/components/donate/ReceiptActions/` (dossier)
- Modify: `src/routes/AppRoutes.jsx`

**Interfaces:** aucune — ces deux modules n'ont plus de consommateur après Task 17 (le tunnel ne redirige plus vers une page de retour, la confirmation est intégrée à `ContributionForm`).

- [ ] **Step 1: Supprimer les dossiers**

```bash
git rm -r src/pages/DonationReturn src/components/donate/ReceiptActions
```

- [ ] **Step 2: Retirer l'import et la route dans `AppRoutes.jsx`**

Supprimer la ligne `import DonationReturn from "../pages/DonationReturn/DonationReturn";` (ligne 16) et le bloc de route associé (lignes 134-141) :

```jsx
      {/* Retour du donateur depuis le guichet de paiement. L'adresse
          est celle déclarée au prestataire (`return_url`)... */}
      <Route
        path="/donate/retour"
        element={<DonationReturn />}
      />
```

- [ ] **Step 3: Vérifier qu'aucune référence résiduelle ne subsiste**

Run: `grep -rn "DonationReturn\|ReceiptActions\|donate/retour" src/`
Expected: aucun résultat

- [ ] **Step 4: Build et vérification manuelle**

```bash
npm run build
npm run dev
```

Naviguer vers `/donate/retour` dans le navigateur : doit tomber sur la page 404 (`NotFound`), pas d'erreur de build.

- [ ] **Step 5: Commit**

```bash
git add -A src/routes/AppRoutes.jsx
git commit -m "chore(dons): retire la page de retour CinetPay et ReceiptActions devenues inutiles"
```

---

## Task 20: `DonationsAdmin.jsx` — nouveaux statuts, preuve, validation

**Files:**
- Modify: `src/pages/admin/DonationsAdmin.jsx` (remplacement intégral)
- Modify: `src/pages/admin/DonationsAdmin.scss` (ajustements de classes de statut et ajout du bloc de revue)

**Interfaces:**
- Consumes: `adminDonations`, `adminDonationSummary`, `reviewDonation`, `adminDonationQrCode` (Task 12), `AdminModal` (existant).

- [ ] **Step 1: Réécrire le composant**

```jsx
// src/pages/admin/DonationsAdmin.jsx
import { useCallback, useState } from "react";

import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FileText,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";

import {
  adminDonations,
  adminDonationQrCode,
  adminDonationSummary,
  reviewDonation,
} from "../../services/donations";

import { apiBaseUrl } from "../../services/http";

import useAsyncData from "../../hooks/useAsyncData";
import usePageMeta from "../../hooks/usePageMeta";

import AdminModal from "../../components/admin/AdminModal";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../components/admin/AdminFeedback";

import "./DonationsAdmin.scss";

const STATUS = {
  valide: { label: "Validé", icon: Check },
  en_attente: { label: "En attente", icon: Clock },
  rejete: { label: "Rejeté", icon: X },
};

const money = (value) => `${Number(value ?? 0).toLocaleString("fr-FR")} F`;

const formatDate = (value) => {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const donorName = (donation) =>
  [donation.donor?.firstName, donation.donor?.lastName].filter(Boolean).join(" ") || "—";

const DonationsAdmin = () => {
  usePageMeta({
    title: "Dons — Administration",
    description:
      "Suivi des contributions reçues par le Centre Apostolique Vie et Abondance.",
  });

  const [status, setStatus] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(
    () => adminDonations(status ? { status, limit: 100 } : { limit: 100 }),
    [status]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const summaryLoad = useCallback(() => adminDonationSummary(), []);
  const { data: summary, reload: reloadSummary } = useAsyncData(summaryLoad);

  const donations = data?.items ?? [];

  const afterReview = () => {
    setReviewing(null);
    reload();
    reloadSummary();
  };

  return (
    <div className="admin-donations">

      <header className="admin-donations__header">
        <div>
          <h1>Dons</h1>
          <p>
            Contributions déclarées par Mobile Money. Chaque don reste « en attente » jusqu'à
            vérification manuelle du numéro de transaction contre le relevé de l'église.
          </p>
        </div>

        <div className="admin-donations__header-actions">
          <button type="button" className="admin-donations__qr-open" onClick={() => setQrOpen(true)}>
            <QrCode size={17} aria-hidden="true" />
            QR code de don
          </button>

          <button type="button" className="admin-donations__refresh" onClick={reload}>
            <RefreshCw size={17} aria-hidden="true" />
            Actualiser
          </button>
        </div>
      </header>

      {summary && (
        <ul className="admin-donations__stats">
          <li className="admin-donations__stat admin-donations__stat--paid">
            <span className="admin-donations__stat-label">Validé ce mois</span>
            <strong>{money(summary.thisMonth?.total)}</strong>
            <span className="admin-donations__stat-hint">{summary.thisMonth?.count ?? 0} don(s)</span>
          </li>

          <li className="admin-donations__stat">
            <span className="admin-donations__stat-label">Total validé</span>
            <strong>{money(summary.valide?.total)}</strong>
            <span className="admin-donations__stat-hint">{summary.valide?.count ?? 0} don(s)</span>
          </li>

          <li className="admin-donations__stat admin-donations__stat--suspect">
            <span className="admin-donations__stat-label">En attente</span>
            <strong>{summary.en_attente?.count ?? 0}</strong>
            <span className="admin-donations__stat-hint">à vérifier</span>
          </li>
        </ul>
      )}

      <div className="admin-donations__filters" role="group" aria-label="Filtrer par statut">
        {[
          ["", "Tous"],
          ["en_attente", "En attente"],
          ["valide", "Validés"],
          ["rejete", "Rejetés"],
        ].map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            className={status === value ? "admin-donations__filter admin-donations__filter--active" : "admin-donations__filter"}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <AdminLoading />}
      {error && <AdminError message={error} onRetry={reload} />}

      {!loading && !error && donations.length === 0 && (
        <AdminEmpty
          message={status ? "Aucun don ne correspond à ce filtre." : "Aucun don pour l'instant."}
        />
      )}

      {!loading && !error && donations.length > 0 && (
        <div className="admin-donations__table-wrap">
          <table className="admin-donations__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Donateur</th>
                <th scope="col">Type</th>
                <th scope="col">Moyen</th>
                <th scope="col">Montant</th>
                <th scope="col">Preuve</th>
                <th scope="col">Statut</th>
                <th scope="col" className="admin-donations__actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {donations.map((donation) => {
                const meta = STATUS[donation.status] ?? STATUS.en_attente;
                const Icon = meta.icon;

                return (
                  <tr key={donation.id}>
                    <td>
                      <span className="admin-donations__date">{formatDate(donation.createdAt)}</span>
                      <span className="admin-donations__reference">{donation.reference}</span>
                    </td>

                    <td>{donorName(donation)}</td>
                    <td>{donation.donationType?.name ?? "—"}</td>
                    <td className="admin-donations__method">{donation.paymentMethod?.name ?? "—"}</td>
                    <td className="admin-donations__amount">{money(donation.amount)}</td>

                    <td>
                      <span className="admin-donations__transaction">{donation.proof?.transactionId}</span>

                      {donation.proof?.imageUrl && (
                        <a
                          href={donation.proof.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-donations__proof-link"
                        >
                          Voir l'image
                        </a>
                      )}
                    </td>

                    <td>
                      <span className={`admin-donations__status admin-donations__status--${donation.status}`}>
                        <Icon size={13} aria-hidden="true" />
                        {meta.label}
                      </span>

                      {donation.adminNote && (
                        <span className="admin-donations__reason">{donation.adminNote}</span>
                      )}

                      {donation.status === "valide" && (
                        <a
                          className="admin-donations__receipt"
                          href={`${apiBaseUrl}/api/donations/${donation.reference}/recu`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={12} aria-hidden="true" />
                          Reçu
                        </a>
                      )}
                    </td>

                    <td>
                      {donation.status === "en_attente" && (
                        <button
                          type="button"
                          className="admin-donations__review-open"
                          onClick={() => setReviewing(donation)}
                        >
                          Vérifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {qrOpen && <QrCodeModal onClose={() => setQrOpen(false)} />}

      {reviewing && (
        <ReviewModal donation={reviewing} onClose={() => setReviewing(null)} onDone={afterReview} />
      )}

    </div>
  );
};

// ------------------------------------------------------------------
// VALIDATION / REJET
// ------------------------------------------------------------------
const ReviewModal = ({ donation, onClose, onDone }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const decide = async (decision) => {
    setBusy(decision);
    setError("");

    try {
      await reviewDonation(donation.id, decision, note);
      onDone();
    } catch (caught) {
      setError(caught.message ?? "La décision n'a pas pu être enregistrée.");
      setBusy("");
    }
  };

  return (
    <AdminModal
      title="Vérifier ce don"
      description="Comparez le numéro de transaction avec le relevé Mobile Money de l'église avant de décider."
      onClose={onClose}
    >
      <div className="admin-donations__review">
        <dl className="admin-donations__review-details">
          <div><dt>Donateur</dt><dd>{donorName(donation)}</dd></div>
          <div><dt>Téléphone</dt><dd>{donation.donor?.phone}</dd></div>
          <div><dt>Montant</dt><dd>{money(donation.amount)}</dd></div>
          <div><dt>Moyen</dt><dd>{donation.paymentMethod?.name}</dd></div>
          <div><dt>Transaction</dt><dd>{donation.proof?.transactionId}</dd></div>
        </dl>

        {donation.proof?.imageUrl && (
          <img
            src={donation.proof.imageUrl}
            alt="Preuve envoyée par le donateur"
            className="admin-donations__review-image"
          />
        )}

        <label className="admin-donations__review-note">
          <span>Remarque (obligatoire en cas de rejet)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. : numéro introuvable sur le relevé du jour"
          />
        </label>

        {error && <p className="step-error" role="alert">{error}</p>}

        <div className="admin-donations__review-actions">
          <button type="button" onClick={() => decide("rejete")} disabled={busy !== ""}>
            {busy === "rejete" ? "Rejet en cours…" : "Rejeter"}
          </button>

          <button
            type="button"
            className="admin-donations__review-validate"
            onClick={() => decide("valide")}
            disabled={busy !== ""}
          >
            {busy === "valide" ? "Validation en cours…" : "Valider"}
          </button>
        </div>
      </div>
    </AdminModal>
  );
};

// ------------------------------------------------------------------
// QR CODE À PROJETER (inchangé dans son fonctionnement)
// ------------------------------------------------------------------
const QrCodeModal = ({ onClose }) => {
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [params, setParams] = useState({});

  const load = useCallback(() => adminDonationQrCode(params), [params]);
  const { data, loading, error, reload } = useAsyncData(load);

  const generate = () => {
    const next = { ...(type ? { type } : {}), ...(amount ? { amount } : {}) };

    if (JSON.stringify(next) === JSON.stringify(params)) reload();
    else setParams(next);
  };

  return (
    <AdminModal
      title="QR code de don"
      description="À projeter pendant un direct ou un culte : en le scannant, le visiteur arrive directement sur la page de don."
      onClose={onClose}
    >
      <div className="admin-donations__qr">
        <div className="admin-donations__qr-fields">
          <label>
            <span>Type de don (identifiant)</span>
            <input
              type="text"
              value={type}
              placeholder="Laisser vide pour un choix libre"
              onChange={(e) => setType(e.target.value)}
            />
          </label>

          <label>
            <span>Montant suggéré (facultatif)</span>
            <input
              type="number"
              min="200"
              step="500"
              value={amount}
              placeholder="Laisser vide pour un montant libre"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>

        <button type="button" className="admin-donations__qr-generate" onClick={generate} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Génération…" : "Générer le QR code"}
        </button>

        {error && <AdminError message={error} onRetry={reload} />}

        {data?.warning && (
          <div className="admin-donations__qr-warning" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{data.warning}</p>
          </div>
        )}

        {data && (
          <div className="admin-donations__qr-result">
            <img src={data.dataUrl} alt="QR code menant à la page de don" />
            <p className="admin-donations__qr-url">{data.url}</p>
            <a className="admin-donations__qr-download" href={data.dataUrl} download="cava-qr-don.png">
              <Download size={16} aria-hidden="true" />
              Télécharger l'image
            </a>
          </div>
        )}
      </div>
    </AdminModal>
  );
};

export default DonationsAdmin;
```

- [ ] **Step 2: Ajuster les styles de statut dans `DonationsAdmin.scss`**

Rechercher les sélecteurs `.admin-donations__status--paid`, `--pending`, `--failed`, `--suspect` et les renommer `--valide`, `--en_attente`, `--rejete` (retirer `--failed`/`--suspect`, devenus inutiles). Ajouter un bloc pour `.admin-donations__review`, `.admin-donations__review-details`, `.admin-donations__review-image`, `.admin-donations__review-note`, `.admin-donations__review-actions`, `.admin-donations__transaction`, `.admin-donations__proof-link`, `.admin-donations__review-open` en reprenant les motifs déjà présents dans le fichier (cartes arrondies, couleurs de `_variables.scss`) — imbriqués sous `.admin-donations` comme le reste du fichier.

- [ ] **Step 3: Vérification manuelle**

```bash
npm run dev
```

Se connecter à `/admin/dons`, vérifier : filtres, colonne preuve, ouverture de la modale de vérification, validation d'un don de test créé via le tunnel public (nécessite Task 9 amorcé + un moyen de paiement activé manuellement en base pour le test).

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/DonationsAdmin.jsx src/pages/admin/DonationsAdmin.scss
git commit -m "feat(dons): admin des dons — nouveaux statuts, preuve, validation/rejet"
```

---

## Task 21: `PaymentMethodsAdmin.jsx` — CRUD des moyens de paiement

**Files:**
- Create: `src/pages/admin/PaymentMethodsAdmin.jsx`

**Interfaces:**
- Consumes: `paymentMethods` (collection générique, Task 12), `AdminCrud` (existant, même contrat que `TestimonialsAdmin`/`MinistriesAdmin`).

- [ ] **Step 1: Écrire le composant**

```jsx
// src/pages/admin/PaymentMethodsAdmin.jsx
import { paymentMethods } from "../../services/api";

import AdminCrud from "../../components/admin/AdminCrud";

import usePageMeta from "../../hooks/usePageMeta";

// Gestion des moyens de paiement Mobile Money affichés dans le tunnel
// de don. Un moyen créé ici reste inactif tant que son image QR et
// son numéro ne sont pas renseignés — voir PaymentMethod.js.
const fields = [
  { name: "name", label: "Nom du moyen", required: true, placeholder: "Orange Money" },
  {
    name: "image",
    label: "QR code officiel",
    type: "upload",
    folder: "paymentMethods",
    accept: "image",
    wide: true,
    help: "Le QR Mobile Money réel de l'église pour ce moyen — c'est lui qui s'affiche au donateur.",
  },
  { name: "accountNumber", label: "Numéro associé", placeholder: "07 00 00 00 00" },
  { name: "holderName", label: "Nom du titulaire", placeholder: "Centre Apostolique Vie et Abondance" },
  { name: "order", label: "Ordre d'affichage", type: "number", help: "Les plus petits nombres apparaissent en premier." },
  {
    name: "active",
    label: "Visible dans le tunnel de don",
    type: "checkbox",
    wide: true,
    help: "N'activez qu'une fois l'image QR et le numéro renseignés — un moyen sans QR ne doit jamais apparaître aux fidèles.",
  },
];

const columns = [
  { key: "name", label: "Moyen" },
  { key: "accountNumber", label: "Numéro" },
  { key: "holderName", label: "Titulaire" },
  {
    key: "active",
    label: "Statut",
    render: (item) =>
      item.active ? "Actif" : <span className="admin-crud__muted">Inactif</span>,
  },
];

const PaymentMethodsAdmin = () => {
  usePageMeta({
    title: "Moyens de paiement — Administration",
    description: "Gestion des QR codes Mobile Money du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={paymentMethods}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un moyen de paiement",
        plural: "Moyens de paiement",
        add: "Ajouter un moyen de paiement",
        empty: "Aucun moyen de paiement enregistré. Le tunnel de don n'affichera aucune option tant qu'aucun n'est actif.",
        loadingSuffix: "des moyens de paiement",
        description: "Si un numéro Mobile Money change, remplacez simplement le QR ici — aucune modification de code n'est nécessaire.",
        titleKey: "name",
      }}
      toValues={(item) => ({
        name: item?.name ?? "",
        image: item?.image?.url ?? "",
        accountNumber: item?.accountNumber ?? "",
        holderName: item?.holderName ?? "",
        order: item?.order ?? 0,
        active: Boolean(item?.active),
      })}
      toPayload={(values) => ({
        name: values.name.trim(),
        image: values.image ? { url: values.image } : undefined,
        accountNumber: values.accountNumber.trim(),
        holderName: values.holderName.trim(),
        order: Number(values.order) || 0,
        active: Boolean(values.active),
      })}
    />
  );
};

export default PaymentMethodsAdmin;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/PaymentMethodsAdmin.jsx
git commit -m "feat(dons): admin CRUD des moyens de paiement"
```

---

## Task 22: `DonationTypesAdmin.jsx` — CRUD des types de don

**Files:**
- Create: `src/pages/admin/DonationTypesAdmin.jsx`

**Interfaces:**
- Consumes: `donationTypes` (collection générique, Task 12), `AdminCrud`.

- [ ] **Step 1: Écrire le composant**

```jsx
// src/pages/admin/DonationTypesAdmin.jsx
import { donationTypes } from "../../services/api";

import AdminCrud from "../../components/admin/AdminCrud";

import usePageMeta from "../../hooks/usePageMeta";

const fields = [
  { name: "name", label: "Nom du type de don", required: true, placeholder: "Dîme" },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    rows: 3,
    help: "Facultatif — n'apparaît pas forcément dans le tunnel, sert de repère interne.",
  },
  { name: "order", label: "Ordre d'affichage", type: "number", help: "Les plus petits nombres apparaissent en premier." },
  { name: "active", label: "Proposé dans le tunnel de don", type: "checkbox" },
];

const columns = [
  { key: "name", label: "Type" },
  { key: "description", label: "Description" },
  {
    key: "active",
    label: "Statut",
    render: (item) =>
      item.active ? "Actif" : <span className="admin-crud__muted">Inactif</span>,
  },
];

const DonationTypesAdmin = () => {
  usePageMeta({
    title: "Types de don — Administration",
    description: "Gestion des types de don proposés sur le site du Centre Apostolique Vie et Abondance.",
  });

  return (
    <AdminCrud
      resource={donationTypes}
      fields={fields}
      columns={columns}
      labels={{
        singular: "un type de don",
        plural: "Types de don",
        add: "Ajouter un type de don",
        empty: "Aucun type de don enregistré. Le tunnel de don n'affichera aucune option tant qu'aucun n'est actif.",
        loadingSuffix: "des types de don",
        description: "Une nouvelle campagne (construction, mission...) s'ajoute ici, sans modification de code.",
        titleKey: "name",
      }}
      toValues={(item) => ({
        name: item?.name ?? "",
        description: item?.description ?? "",
        order: item?.order ?? 0,
        active: item?.active ?? true,
      })}
      toPayload={(values) => ({
        name: values.name.trim(),
        description: values.description.trim(),
        order: Number(values.order) || 0,
        active: Boolean(values.active),
      })}
    />
  );
};

export default DonationTypesAdmin;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/DonationTypesAdmin.jsx
git commit -m "feat(dons): admin CRUD des types de don"
```

---

## Task 23: Câblage des routes et de la navigation admin

**Files:**
- Modify: `src/routes/AdminRoutes.jsx`
- Modify: `src/pages/admin/AdminLayout.jsx`

**Interfaces:**
- Consumes: `PaymentMethodsAdmin` (Task 21), `DonationTypesAdmin` (Task 22).

- [ ] **Step 1: Ajouter les imports et les routes dans `AdminRoutes.jsx`**

Après `import DonationsAdmin from "../pages/admin/DonationsAdmin";` :

```jsx
import PaymentMethodsAdmin from "../pages/admin/PaymentMethodsAdmin";
import DonationTypesAdmin from "../pages/admin/DonationTypesAdmin";
```

Après le bloc `<Route path="dons" ...>` :

```jsx
        <Route
          path="dons/moyens-de-paiement"
          element={
            <RequireRole allow={["admin"]}>
              <PaymentMethodsAdmin />
            </RequireRole>
          }
        />

        <Route
          path="dons/types"
          element={
            <RequireRole allow={["admin"]}>
              <DonationTypesAdmin />
            </RequireRole>
          }
        />
```

(`allow={["admin"]}`, plus strict que `STAFF_ROLES` : la gestion des moyens de paiement touche à des numéros financiers réels, cohérent avec la restriction déjà actée pour `POST /admin/donations/:id/review`.)

- [ ] **Step 2: Ajouter les entrées de navigation dans `AdminLayout.jsx`**

Importer `Wallet` et `Tag` depuis `lucide-react` (ajouter aux imports existants de `lucide-react`).

Dans `NAV_GROUPS`, juste après l'entrée `{ to: "/admin/dons", label: "Dons", icon: HandCoins, roles: STAFF_ROLES }` :

```jsx
      {
        to: "/admin/dons/moyens-de-paiement",
        label: "Moyens de paiement",
        icon: Wallet,
        roles: ["admin"],
      },
      {
        to: "/admin/dons/types",
        label: "Types de don",
        icon: Tag,
        roles: ["admin"],
      },
```

- [ ] **Step 3: Vérification manuelle**

```bash
npm run dev
```

Se connecter en tant qu'admin, vérifier que « Moyens de paiement » et « Types de don » apparaissent dans le menu, mènent aux bonnes pages, et sont absents pour un compte `editor` (créer un compte de test `editor` si nécessaire, ou vérifier via `RequireRole` dans le code que `["admin"]` exclut bien `editor`).

- [ ] **Step 4: Commit**

```bash
git add src/routes/AdminRoutes.jsx src/pages/admin/AdminLayout.jsx
git commit -m "feat(dons): câble les routes et la navigation admin des moyens de paiement et types de don"
```

---

## Task 24: Vérification finale bout-en-bout

**Files:** aucun — vérification uniquement.

- [ ] **Step 1: Suite de tests complète**

```bash
cd backend && npm test
cd .. && npm test
```

Expected: PASS partout, aucune régression.

- [ ] **Step 2: Lint et build**

```bash
npm run lint
npm run build
cd backend && node -e "import('./src/config/env.js').then(({validateEnv}) => validateEnv())"
```

Expected: aucune erreur ESLint, build Vite réussi, configuration backend valide sans les variables CinetPay.

- [ ] **Step 3: Parcours manuel complet en local**

```bash
cd backend && npm run seed && npm run dev
```

Dans un autre terminal : `npm run dev` (frontend).

1. Se connecter à `/admin/dons/moyens-de-paiement`, activer « Orange Money » avec un numéro et une image QR de test.
2. Se connecter à `/admin/dons/types`, vérifier que les 6 types amorcés sont actifs.
3. Sur `/donate`, dérouler le tunnel complet : identité → montant/type → moyen de paiement → billet QR → numéro de transaction → envoi. Vérifier l'écran de confirmation et la référence affichée.
4. Sur `/admin/dons`, retrouver le don « en attente », ouvrir la vérification, valider avec une remarque vide (autorisé), vérifier le lien « Reçu » apparaît et s'ouvre correctement (PDF avec les bons libellés type/moyen).
5. Créer un second don de test, le rejeter sans remarque : doit être bloqué avec un message clair ; rejeter avec une remarque : doit réussir.

- [ ] **Step 4: Mettre à jour `CLAUDE.md`**

Une fois les 23 tâches précédentes validées, documenter dans `CLAUDE.md` : l'existence réelle du backend Node/Express/MongoDB (`backend/`), son déploiement Render, la commande de test backend (`cd backend && npm test`), et remplacer la section dons obsolète (CinetPay) par une description du nouveau parcours Mobile Money manuel. Demandé explicitement par l'utilisateur en fin de fonctionnalité.

- [ ] **Step 5: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: met à jour CLAUDE.md (backend réel, nouveau parcours de dons)"
```
