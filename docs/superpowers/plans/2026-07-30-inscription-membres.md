# Système d'inscription des membres avec matricule — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un membre de s'inscrire lui-même (nouveau, ou déjà porteur d'un matricule papier) via un formulaire public en plusieurs étapes, avec attribution automatique du matricule après validation par un administrateur, et export de la liste des membres en Excel et PDF.

**Architecture:** Backend Express/MongoDB : trois nouveaux modèles (`Flock`, `RegistrationCounter`, `MemberSubmission`), un service pur de génération/validation de matricule, un service de soumission/modération, un service d'export. Frontend React : un formulaire public en tunnel (calqué sur `ContributionForm` déjà existant côté Don), et trois nouveaux panneaux dans l'espace d'administration existant (`CommunityAdmin.jsx`) — Bergeries, file d'inscriptions, et enrichissement de l'onglet Membres.

**Tech Stack:** Express 5, Mongoose 8, React 19, Vite, SCSS (BEM imbriqué). Nouvelle dépendance backend : `exceljs`. Aucune nouvelle dépendance frontend.

## Global Constraints

- **Aucune infrastructure de test n'est configurée dans ce projet** (`CLAUDE.md`) — ne jamais inventer de commande `npm test`. Chaque tâche remplace le cycle TDD habituel (test qui échoue → implémentation → test qui passe) par une **vérification manuelle explicite** : script Node jetable pour la logique pure (non commité), requêtes `curl` avec réponse JSON attendue pour les routes API, `npm run build` + parcours navigateur pour le frontend.
- JavaScript/JSX uniquement — ne jamais convertir en TypeScript.
- Code (noms de variables, champs de modèle, composants) en anglais ; contenu, libellés d'interface et commentaires en français — convention déjà suivie par `Member.js` (`firstName`, `role: "membre"`).
- SCSS : aucun CSS module. Toute classe déclarée dans un fichier de composant doit être imbriquée sous la classe racine du composant (`.registration-form .form-group`, jamais `.form-group` seul) — piège déjà survenu 4 fois sur ce projet (voir `CLAUDE.md`).
- Les membres restent des données personnelles jamais exposées publiquement en lecture ; seule l'écriture `POST /api/submissions` est publique, et elle n'écrit jamais dans `Member`.
- Réponses API au format existant : `{ success, message, data, meta? }` via `sendSuccess`/`sendCreated`/`sendNoContent` (`backend/src/utils/respond.js`).
- Toute erreur métier est levée via `ApiError` (`backend/src/utils/ApiError.js`), jamais un `throw new Error()` brut dans un service.

---

## Vue d'ensemble des fichiers

**Backend — nouveaux fichiers**
- `backend/src/models/Flock.js`
- `backend/src/models/RegistrationCounter.js`
- `backend/src/models/MemberSubmission.js`
- `backend/src/services/registrationNumber.service.js`
- `backend/src/services/submission.service.js`
- `backend/src/services/memberExport.service.js`

**Backend — fichiers modifiés**
- `backend/src/models/Member.js`
- `backend/src/middlewares/rateLimit.js`
- `backend/src/routes/index.js`
- `backend/package.json`

**Frontend — nouveaux fichiers**
- `src/utils/registrationNumber.js`
- `src/components/registration/RegistrationForm/data.js`
- `src/components/registration/RegistrationForm/StepLookup.jsx`
- `src/components/registration/RegistrationForm/StepIdentity.jsx`
- `src/components/registration/RegistrationForm/StepContact.jsx`
- `src/components/registration/RegistrationForm/StepCivilStatus.jsx`
- `src/components/registration/RegistrationForm/StepSpiritualLife.jsx`
- `src/components/registration/RegistrationForm/StepEngagement.jsx`
- `src/components/registration/RegistrationForm/StepSummary.jsx`
- `src/components/registration/RegistrationForm/index.jsx`
- `src/components/registration/RegistrationForm/RegistrationForm.scss`
- `src/context/RegistrationContext.jsx`
- `src/pages/Registration/Registration.jsx`
- `src/pages/Registration/Registration.scss`
- `src/components/admin/SubmissionsPanel/index.jsx`
- `src/components/admin/SubmissionsPanel/SubmissionsPanel.scss`

**Frontend — fichiers modifiés**
- `src/services/api.js`
- `src/services/http.js` (aucun changement de code, réutilisé tel quel — mentionné pour référence)
- `src/pages/admin/CommunityAdmin.jsx`
- `src/pages/admin/CommunityAdmin.scss`
- `src/routes/AdminRoutes.jsx` (aucune route à ajouter — les nouveaux panneaux vivent dans `CommunityAdmin`, mentionné pour clarté)
- `src/routes/AppRoutes.jsx`
- `src/components/Navbar/Navbar.jsx`

---

## Backend

### Task 1: Modèles `Flock` et `RegistrationCounter`

**Files:**
- Create: `backend/src/models/Flock.js`
- Create: `backend/src/models/RegistrationCounter.js`

**Interfaces:**
- Produces: `Flock` (Mongoose model) — champs `code` (String, 2 lettres majuscules), `name` (String), `church` (Number 1-5), `status` (enum `draft`/`published`/`archived`, défaut `published`). Index unique composé `{ church: 1, code: 1 }`.
- Produces: `RegistrationCounter` (Mongoose model) — champs `church` (Number, unique), `lastNumber` (Number, défaut 0). Jamais exposé par une route CRUD.

- [ ] **Step 1: Créer le modèle `Flock`**

```js
import mongoose from "mongoose";

// Bergerie à laquelle un membre appartient.
//
// Le code (2 lettres) fait partie du matricule du membre — voir
// registrationNumber.service.js. Un même code peut exister dans deux
// églises différentes, mais pas deux fois dans la même : d'où l'index
// composé plutôt qu'un index simple sur `code`.
const flockSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Le code de la bergerie est obligatoire."],
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z]{2}$/,
        "Le code doit comporter exactement 2 lettres.",
      ],
    },

    name: {
      type: String,
      required: [true, "Le nom de la bergerie est obligatoire."],
      trim: true,
      maxlength: 120,
    },

    church: {
      type: Number,
      required: [true, "L'église est obligatoire."],
      min: 1,
      max: 5,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

flockSchema.index({ church: 1, code: 1 }, { unique: true });

export default mongoose.model("Flock", flockSchema);
```

- [ ] **Step 2: Créer le modèle `RegistrationCounter`**

```js
import mongoose from "mongoose";

// Compteur atomique de matricules, un document par église.
//
// Jamais exposé par une route CRUD : seule la génération de matricule
// (voir registrationNumber.service.js) l'incrémente, via `$inc`, pour
// que deux validations simultanées ne produisent jamais le même
// numéro.
const registrationCounterSchema = new mongoose.Schema({
  church: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 5,
  },

  lastNumber: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model(
  "RegistrationCounter",
  registrationCounterSchema
);
```

- [ ] **Step 3: Vérifier manuellement**

Depuis `backend/`, lancer `node --input-type=module` et coller :

```js
import mongoose from "mongoose";
import "dotenv/config";
import Flock from "./src/models/Flock.js";
import RegistrationCounter from "./src/models/RegistrationCounter.js";

await mongoose.connect(process.env.MONGO_URI);

const flock = await Flock.create({ code: "ol", name: "El Olam", church: 1 });
console.log("Flock créé :", flock.code, flock.church);

const counter = await RegistrationCounter.findOneAndUpdate(
  { church: 1 },
  { $inc: { lastNumber: 1 } },
  { new: true, upsert: true }
);
console.log("Compteur :", counter.lastNumber);

await Flock.deleteOne({ _id: flock._id });
await RegistrationCounter.deleteOne({ church: 1 });
await mongoose.disconnect();
```

Résultat attendu : `Flock créé : OL 1` (le code est bien remonté en majuscules par le schéma) puis `Compteur : 1`. Aucune erreur de validation ou de connexion.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/Flock.js backend/src/models/RegistrationCounter.js
git commit -m "feat(backend): ajoute les modeles Flock et RegistrationCounter"
```

---

### Task 2: Service de génération et de validation du matricule

**Files:**
- Create: `backend/src/services/registrationNumber.service.js`

**Interfaces:**
- Consumes: `RegistrationCounter` (Task 1), `ApiError` (`backend/src/utils/ApiError.js`).
- Produces: `letterForNumber(number)`, `normalizeRegistrationNumber(input)`, `formatRegistrationNumber(canonical)`, `parseRegistrationNumber(canonical)`, `hasValidControlLetter(canonical)`, `nextRegistrationNumber({ church, flockCode, year })` (async, retourne `{ registrationNumber, number, letter }`) — utilisés par Task 4 (`submission.service.js`) et Task 6 (`memberExport.service.js`).

- [ ] **Step 1: Écrire le service**

```js
import RegistrationCounter from "../models/RegistrationCounter.js";
import { ApiError } from "../utils/ApiError.js";

// Génération et validation du matricule des membres.
//
// Format canonique stocké (9 caractères, sans espace) : "1OL25045S".
//   1        OL        25        045        S
//   église   bergerie  année     n° dans     lettre de
//   (1-5)    (2 lettres)(2 ch.)  l'église    contrôle
//                                (3 ch.)
//
// La lettre n'est JAMAIS saisie : elle se déduit du numéro
// (lettre = alphabet[(numéro - 1) % 26]). C'est un simple repère
// visuel de contrôle, pas un mécanisme de sécurité — elle permet à un
// administrateur de repérer une erreur de recopie avant de valider une
// inscription, comme observé sur le registre papier existant (un
// numéro dupliqué gardait la bonne lettre du rang réel).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^([1-5])([A-Z]{2})(\d{2})(\d{3})([A-Z])$/;

// Plafond du compteur sur 3 chiffres. Au-delà, il faut un format sur 4
// chiffres — changement hors périmètre, qui casserait tous les
// matricules déjà attribués.
const MAX_NUMBER = 999;

export const letterForNumber = (number) => ALPHABET[(number - 1) % 26];

export const normalizeRegistrationNumber = (input) =>
  String(input ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");

export const formatRegistrationNumber = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return canonical ?? "";

  const [, church, flockCode, year, number, letter] = match;

  return `${church}${flockCode} ${year}-${number} ${letter}`;
};

export const parseRegistrationNumber = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return null;

  const [, church, flockCode, year, number, letter] = match;

  return {
    church: Number(church),
    flockCode,
    year: Number(year),
    number: Number(number),
    letter,
  };
};

export const hasValidControlLetter = (canonical) => {
  const parsed = parseRegistrationNumber(canonical);

  if (!parsed) return false;

  return parsed.letter === letterForNumber(parsed.number);
};

// Incrémente le compteur atomique de l'église et construit le
// matricule correspondant.
//
// `findOneAndUpdate` + `$inc` : deux validations simultanées par deux
// administrateurs ne peuvent jamais obtenir le même numéro, y compris
// au tout premier enregistrement d'une église (upsert).
export const nextRegistrationNumber = async ({
  church,
  flockCode,
  year,
}) => {
  const counter = await RegistrationCounter.findOneAndUpdate(
    { church },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );

  if (counter.lastNumber > MAX_NUMBER) {
    throw ApiError.conflict(
      `Le plafond de ${MAX_NUMBER} matricules pour l'église ${church} est atteint. ` +
        "Un développeur doit étendre le format avant de valider de nouvelles inscriptions pour cette église."
    );
  }

  const number = counter.lastNumber;
  const letter = letterForNumber(number);
  const yy = String(year).slice(-2).padStart(2, "0");
  const registrationNumber = `${church}${flockCode}${yy}${String(
    number
  ).padStart(3, "0")}${letter}`;

  return { registrationNumber, number, letter };
};
```

- [ ] **Step 2: Vérifier manuellement les fonctions pures (sans base de données)**

Créer temporairement `backend/scripts/_verify-registration-number.js` :

```js
import {
  letterForNumber,
  normalizeRegistrationNumber,
  formatRegistrationNumber,
  parseRegistrationNumber,
  hasValidControlLetter,
} from "../src/services/registrationNumber.service.js";

console.assert(letterForNumber(1) === "A", "1 -> A");
console.assert(letterForNumber(26) === "Z", "26 -> Z");
console.assert(letterForNumber(27) === "A", "27 reboucle -> A");

console.assert(
  normalizeRegistrationNumber("1ol 16-005 e") === "1OL16005E",
  "normalisation"
);

console.assert(
  formatRegistrationNumber("1OL16005E") === "1OL 16-005 E",
  "formatage"
);

const parsed = parseRegistrationNumber("1ME23044R");
console.assert(
  parsed.church === 1 && parsed.flockCode === "ME" && parsed.year === 23 && parsed.number === 44,
  "parsing"
);

// Ligne 044 corrigée du registre papier (043 -> 044) : la lettre R
// est correcte pour le rang 44.
console.assert(hasValidControlLetter("1ME23044R") === true, "lettre valide");
// Le matricule fautif original (numéro 043 dupliqué) doit être détecté.
console.assert(hasValidControlLetter("1ME23043R") === false, "lettre invalide détectée");

console.log("Toutes les vérifications sont passées.");
```

Lancer depuis `backend/` : `node scripts/_verify-registration-number.js`
Résultat attendu : `Toutes les vérifications sont passées.` sans message `Assertion failed`.

Supprimer ensuite ce fichier (`rm scripts/_verify-registration-number.js` ou `Remove-Item`) — c'est un script de vérification jetable, jamais commité.

- [ ] **Step 3: Vérifier manuellement `nextRegistrationNumber` (avec base de données)**

Même méthode que Task 1 Step 3, script jetable :

```js
import mongoose from "mongoose";
import "dotenv/config";
import { nextRegistrationNumber } from "./src/services/registrationNumber.service.js";
import RegistrationCounter from "./src/models/RegistrationCounter.js";

await mongoose.connect(process.env.MONGO_URI);

await RegistrationCounter.deleteOne({ church: 9 }); // église fictive de test

const first = await nextRegistrationNumber({ church: 9, flockCode: "ZZ", year: 2026 });
console.log("Premier :", first); // attendu : { registrationNumber: "9ZZ26001A", number: 1, letter: "A" }

const second = await nextRegistrationNumber({ church: 9, flockCode: "ZZ", year: 2026 });
console.log("Second :", second); // attendu : numéro 2, lettre "B"

await RegistrationCounter.deleteOne({ church: 9 });
await mongoose.disconnect();
```

Résultat attendu : deux matricules consécutifs (`9ZZ26001A` puis `9ZZ26002B`), sans erreur.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/registrationNumber.service.js
git commit -m "feat(backend): ajoute le service de generation du matricule"
```

---

### Task 3: Extension du modèle `Member`

**Files:**
- Modify: `backend/src/models/Member.js`

**Interfaces:**
- Produces: nouveaux champs sur `Member` — `registrationNumber`, `church`, `flock` (ref `Flock`), `dateOfBirth`, `gender`, `maritalStatus`, `childrenCount`, `conversionYear`, `baptism.water`/`waterYear`/`holySpirit`, `previousChurch`, `profession`, `skills[]`, `desiredDepartment`, `availability`, `whatsapp`, `address`, `emergencyContact.name`/`phone`. Consommés par Task 4 (`submission.service.js`), Task 6 (`memberExport.service.js`) et les tâches frontend d'administration.

- [ ] **Step 1: Ajouter les champs au schéma**

Dans `backend/src/models/Member.js`, ajouter les imports et sous-schémas juste après les imports existants (ligne 1-2), puis insérer les nouveaux champs dans `memberSchema` avant le champ `notes` (ligne 79 actuelle) :

```js
const baptismSchema = new mongoose.Schema(
  {
    water: { type: Boolean, default: false },
    waterYear: { type: Number, min: 1900, max: 2100 },
    holySpirit: { type: Boolean, default: false },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false }
);
```

Puis, dans `memberSchema`, juste avant le champ `notes` :

```js
    // Matricule et rattachement — voir registrationNumber.service.js
    // pour le format et la génération.
    registrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      match: [
        /^[1-5][A-Z]{2}\d{2}\d{3}[A-Z]$/,
        "Matricule invalide.",
      ],
    },

    church: { type: Number, min: 1, max: 5 },

    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
    },

    // État civil
    dateOfBirth: Date,
    gender: { type: String, enum: ["homme", "femme"] },
    maritalStatus: {
      type: String,
      enum: ["celibataire", "marie", "veuf", "divorce"],
    },
    childrenCount: { type: Number, min: 0, max: 30 },

    // Vie spirituelle
    conversionYear: { type: Number, min: 1900, max: 2100 },
    baptism: { type: baptismSchema, default: () => ({}) },
    previousChurch: { type: String, trim: true, maxlength: 160 },

    // Engagement et service
    profession: { type: String, trim: true, maxlength: 120 },
    skills: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 20,
        message: "20 compétences maximum.",
      },
      default: [],
    },
    desiredDepartment: { type: String, trim: true, maxlength: 120 },
    availability: { type: String, trim: true, maxlength: 300 },

    // Contact étendu — le quartier reste porté par le champ `area`
    // existant, pas de doublon ici.
    whatsapp: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 300 },
    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },
    photo: { type: String, trim: true },
```

Enfin, après l'index existant `memberSchema.index({ lastName: 1, firstName: 1 });` (ligne 90), ajouter :

```js
memberSchema.index({ church: 1, flock: 1 });
```

- [ ] **Step 2: Vérifier manuellement**

Script jetable, comme précédemment :

```js
import mongoose from "mongoose";
import "dotenv/config";
import Member from "./src/models/Member.js";

await mongoose.connect(process.env.MONGO_URI);

const member = await Member.create({
  firstName: "Test",
  lastName: "Vérification",
  registrationNumber: "1OL16005E",
  church: 1,
  gender: "homme",
  baptism: { water: true, waterYear: 2020 },
  skills: ["musique", "accueil"],
});

console.log("Créé :", member.registrationNumber, member.baptism.water, member.skills);

// Un second membre avec le même matricule doit être rejeté.
try {
  await Member.create({
    firstName: "Doublon",
    lastName: "Test",
    registrationNumber: "1OL16005E",
  });
  console.error("ERREUR : le doublon aurait dû être rejeté");
} catch (error) {
  console.log("Doublon correctement rejeté :", error.code === 11000);
}

await Member.deleteMany({ lastName: /Vérification|Test/ });
await mongoose.disconnect();
```

Résultat attendu : `Créé : 1OL16005E true [ 'musique', 'accueil' ]` puis `Doublon correctement rejeté : true`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/Member.js
git commit -m "feat(backend): etend Member avec matricule et nouveaux champs d'inscription"
```

---

### Task 4: Modèle `MemberSubmission` et service de soumissions

**Files:**
- Create: `backend/src/models/MemberSubmission.js`
- Create: `backend/src/services/submission.service.js`

**Interfaces:**
- Consumes: `Member` (Task 3), `Flock` (Task 1), `registrationNumber.service.js` (Task 2), `ApiError`.
- Produces: `submit({ type, registrationNumber, data })`, `listPending({ page, limit })`, `getById(id)` (retourne `{ submission, currentMember }`), `approve(id, { overrides, user })` (retourne `{ member, submission }`), `reject(id, { reason, user })` — utilisés par Task 5 (routes).

- [ ] **Step 1: Créer le modèle `MemberSubmission`**

```js
import mongoose from "mongoose";

// Soumission publique d'inscription ou de mise à jour, en attente de
// revue par un administrateur.
//
// N'écrit jamais directement `Member` : c'est le service d'approbation
// (submission.service.js) qui, seul, transforme une soumission validée
// en fiche membre. `data` porte une copie brute des champs du
// formulaire — la validation stricte a lieu au moment de la création
// du `Member`, quand l'administrateur valide, pas ici.
const memberSubmissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["new", "update"],
      required: true,
    },

    // Rempli seulement pour `type: "update"`, sous forme normalisée
    // (voir normalizeRegistrationNumber), tel que saisi par le membre.
    submittedRegistrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Résolu côté serveur si `submittedRegistrationNumber` correspond
    // à un membre déjà informatisé. Jamais renvoyé au formulaire
    // public : utilisé uniquement par l'écran de comparaison de
    // l'administration.
    existingMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    rejectionReason: { type: String, trim: true, maxlength: 500 },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    processedAt: Date,
  },
  { timestamps: true }
);

memberSubmissionSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model(
  "MemberSubmission",
  memberSubmissionSchema
);
```

- [ ] **Step 2: Écrire le service de soumissions**

```js
import MemberSubmission from "../models/MemberSubmission.js";
import Member from "../models/Member.js";
import Flock from "../models/Flock.js";

import { ApiError } from "../utils/ApiError.js";
import {
  normalizeRegistrationNumber,
  parseRegistrationNumber,
  nextRegistrationNumber,
} from "./registrationNumber.service.js";

const MAX_LIMIT = 100;

// Champs que le formulaire public peut proposer. Toute autre clé
// envoyée est ignorée : un client ne doit pas pouvoir glisser
// `status`, `notes` ou tout champ réservé à l'administration dans une
// soumission publique.
const ALLOWED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "whatsapp",
  "address",
  "church",
  "flock",
  "dateOfBirth",
  "gender",
  "maritalStatus",
  "childrenCount",
  "conversionYear",
  "baptism",
  "previousChurch",
  "profession",
  "skills",
  "desiredDepartment",
  "availability",
  "emergencyContact",
];

const pickAllowed = (payload = {}) =>
  ALLOWED_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) accumulator[field] = payload[field];

    return accumulator;
  }, {});

// ---- Écriture publique -------------------------------------------

export const submit = async ({ type, registrationNumber, data }) => {
  if (!["new", "update"].includes(type)) {
    throw ApiError.badRequest("Type de soumission invalide.");
  }

  const clean = pickAllowed(data);

  if (!clean.firstName?.trim() || !clean.lastName?.trim()) {
    throw ApiError.badRequest(
      "Le prénom et le nom sont obligatoires."
    );
  }

  const submission = { type, data: clean };

  if (type === "update") {
    const normalized = normalizeRegistrationNumber(registrationNumber);

    if (!normalized) {
      throw ApiError.badRequest(
        "Le matricule est obligatoire pour une mise à jour."
      );
    }

    submission.submittedRegistrationNumber = normalized;

    // Recherché côté serveur uniquement : jamais renvoyé à
    // l'appelant, qui ne reçoit qu'un accusé de réception neutre.
    const existing = await Member.findOne({
      registrationNumber: normalized,
    })
      .select("_id")
      .lean();

    if (existing) submission.existingMember = existing._id;
  }

  await MemberSubmission.create(submission);

  return { received: true };
};

// ---- Administration -----------------------------------------------

export const listPending = async ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

  const filter = { status: "pending" };

  const [items, total] = await Promise.all([
    MemberSubmission.find(filter)
      .sort({ createdAt: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    MemberSubmission.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

// Détail d'une soumission, avec la fiche membre actuelle en regard
// pour permettre le comparatif avant/après côté administration.
export const getById = async (id) => {
  const submission = await MemberSubmission.findById(id).lean();

  if (!submission) {
    throw ApiError.notFound("Soumission introuvable.");
  }

  const currentMember = submission.existingMember
    ? await Member.findById(submission.existingMember)
        .populate("flock", "name code")
        .lean()
    : null;

  return { submission, currentMember };
};

const assertFlockBelongsToChurch = async (flockId, church) => {
  const flock = await Flock.findById(flockId).lean();

  if (!flock || flock.church !== Number(church)) {
    throw ApiError.badRequest(
      "La bergerie sélectionnée ne correspond pas à cette église."
    );
  }

  return flock;
};

export const approve = async (id, { overrides = {}, user } = {}) => {
  const submission = await MemberSubmission.findById(id);

  if (!submission) {
    throw ApiError.notFound("Soumission introuvable.");
  }

  if (submission.status !== "pending") {
    throw ApiError.conflict("Cette soumission a déjà été traitée.");
  }

  const data = { ...submission.data, ...pickAllowed(overrides) };

  if (!data.church || !data.flock) {
    throw ApiError.unprocessable(
      "L'église et la bergerie sont obligatoires pour valider."
    );
  }

  const flock = await assertFlockBelongsToChurch(data.flock, data.church);

  let member;

  if (submission.existingMember) {
    member = await Member.findByIdAndUpdate(
      submission.existingMember,
      data,
      { new: true, runValidators: true }
    );

    if (!member) {
      throw ApiError.notFound("Le membre à mettre à jour n'existe plus.");
    }
  } else if (submission.submittedRegistrationNumber) {
    // Matricule papier jamais informatisé : repris tel quel, sans
    // passer par le compteur, qui ne doit générer QUE des matricules
    // neufs. L'année d'arrivée se déduit du matricule lui-même plutôt
    // que de la date du jour.
    const parsed = parseRegistrationNumber(
      submission.submittedRegistrationNumber
    );
    const joinedAt = parsed ? new Date(2000 + parsed.year, 0, 1) : undefined;

    try {
      member = await Member.create({
        ...data,
        registrationNumber: submission.submittedRegistrationNumber,
        ...(joinedAt ? { joinedAt } : {}),
      });
    } catch (error) {
      if (error.code === 11000) {
        throw ApiError.conflict(
          "Ce matricule est déjà attribué à un autre membre."
        );
      }

      throw error;
    }
  } else {
    const currentYear = new Date().getFullYear();
    const { registrationNumber } = await nextRegistrationNumber({
      church: data.church,
      flockCode: flock.code,
      year: currentYear,
    });

    member = await Member.create({ ...data, registrationNumber });
  }

  submission.status = "approved";
  submission.processedBy = user?.id;
  submission.processedAt = new Date();

  await submission.save();

  return { member: member.toJSON(), submission: submission.toJSON() };
};

export const reject = async (id, { reason, user } = {}) => {
  const submission = await MemberSubmission.findById(id);

  if (!submission) {
    throw ApiError.notFound("Soumission introuvable.");
  }

  if (submission.status !== "pending") {
    throw ApiError.conflict("Cette soumission a déjà été traitée.");
  }

  submission.status = "rejected";
  submission.rejectionReason = reason?.trim() || undefined;
  submission.processedBy = user?.id;
  submission.processedAt = new Date();

  await submission.save();

  return submission.toJSON();
};
```

- [ ] **Step 3: Vérifier manuellement**

Script jetable (nécessite un `Flock` existant — le premier bloc en crée un temporaire) :

```js
import mongoose from "mongoose";
import "dotenv/config";
import Flock from "./src/models/Flock.js";
import Member from "./src/models/Member.js";
import MemberSubmission from "./src/models/MemberSubmission.js";
import * as submissionService from "./src/services/submission.service.js";

await mongoose.connect(process.env.MONGO_URI);

const flock = await Flock.create({ code: "ZZ", name: "Test", church: 9 });

// 1. Soumission "new" — un champ interdit (`status`) doit être ignoré.
const result = await submissionService.submit({
  type: "new",
  data: {
    firstName: "Jean",
    lastName: "Kouassi",
    church: 9,
    flock: String(flock._id),
    phone: "0700000000",
    status: "admin", // doit être filtré
  },
});
console.log("Soumission créée :", result);

const [pending] = (await submissionService.listPending()).items;
console.log("En attente :", pending.data.firstName, pending.data.status === undefined);

const { member } = await submissionService.approve(pending._id, {
  user: { id: new mongoose.Types.ObjectId() },
});
console.log("Membre créé avec matricule :", member.registrationNumber);

await Member.deleteMany({ church: 9 });
await MemberSubmission.deleteMany({});
await Flock.deleteOne({ _id: flock._id });
await mongoose.connection.collection("registrationcounters").deleteOne({ church: 9 });
await mongoose.disconnect();
```

Résultat attendu : un matricule au format `9ZZ26001A` (année courante), et `En attente : Jean true` (confirmant que `status: "admin"` a bien été filtré).

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/MemberSubmission.js backend/src/services/submission.service.js
git commit -m "feat(backend): ajoute MemberSubmission et le service de moderation"
```

---

### Task 5: Limiteur de débit et routes (bergeries, soumissions)

**Files:**
- Modify: `backend/src/middlewares/rateLimit.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `Flock` (Task 1), `submission.service.js` (Task 4), `createCrudService`/`resourceRouter` (existants).
- Produces: routes `GET /api/flocks`, `GET/POST/PATCH/DELETE /api/admin/flocks*`, `POST /api/submissions`, `GET /api/admin/submissions`, `GET /api/admin/submissions/:id`, `POST /api/admin/submissions/:id/approve`, `POST /api/admin/submissions/:id/reject`.

- [ ] **Step 1: Ajouter le limiteur de débit**

Dans `backend/src/middlewares/rateLimit.js`, après `contactLimiter` (fin de fichier) :

```js
// Inscriptions et mises à jour de fiche membre.
//
// Même fenêtre que le formulaire de contact : c'est l'autre seule
// écriture publique de l'API, avec le même risque de spam.
export const submissionLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Vous avez envoyé plusieurs demandes récemment. Merci de patienter avant d'en envoyer une nouvelle.",
      error: { status: 429 },
    });
  },
});
```

- [ ] **Step 2: Monter les routes**

Dans `backend/src/routes/index.js` :

1. Ajouter les imports, après `import Message from "../models/Message.js";` (ligne 10) :

```js
import Flock from "../models/Flock.js";
import * as submissionService from "../services/submission.service.js";
```

2. Ajouter aux imports de `rateLimit.js` (ligne 34-40), `submissionLimiter` :

```js
import {
  loginLimiter,
  twoFactorLimiter,
  twoFactorManageLimiter,
  contactLimiter,
  donationLimiter,
  submissionLimiter,
} from "../middlewares/rateLimit.js";
```

3. Ajouter le service `flocks`, juste après le service `members` (ligne 77, après la fermeture du bloc `const members = createCrudService(...)`) :

```js
const flocks = createCrudService(Flock, {
  label: "Bergerie",
  defaultSort: { church: 1, name: 1 },
  publicSort: { church: 1, name: 1 },
  searchableFields: ["name", "code"],
});
```

4. Ajouter `"registrationNumber"` aux `searchableFields` du service `members` existant (ligne 76) :

```js
const members = createCrudService(Member, {
  label: "Membre",
  defaultSort: { lastName: 1, firstName: 1 },
  publicFilter: { _id: null },
  searchableFields: ["firstName", "lastName", "registrationNumber"],
});
```

5. Monter `flocks`, juste après `mount("ministries", ministries, {...})` (ligne 321) :

```js
  mount("flocks", flocks, {
    publicBySlug: false,
    publicFilters: ["church"],
    auditResource: "flock",
  });
```

6. Ajouter les routes de soumissions, juste avant `mount("members", members, {...})` (ligne 342 actuelle) :

```js
  // ---- Inscriptions et mises à jour de fiche membre -------------
  //
  // Seule écriture publique de cette fonctionnalité. N'écrit JAMAIS
  // dans `Member` : uniquement dans `MemberSubmission`, en attente de
  // revue par un administrateur (voir submission.service.js).
  api.post(
    "/submissions",
    submissionLimiter,
    asyncHandler(async (req, res) => {
      const result = await submissionService.submit({
        type: req.body?.type,
        registrationNumber: req.body?.registrationNumber,
        data: req.body?.data,
      });

      sendCreated(res, {
        message: "Votre demande a été transmise à l'équipe.",
        data: result,
      });
    })
  );

  const adminSubmissions = Router();

  adminSubmissions.use(requireAuth);

  adminSubmissions.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, meta } = await submissionService.listPending({
        page: req.query.page,
        limit: req.query.limit,
      });

      sendSuccess(res, { data: items, meta });
    })
  );

  adminSubmissions.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = await submissionService.getById(req.params.id);

      sendSuccess(res, { data });
    })
  );

  adminSubmissions.post(
    "/:id/approve",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = await submissionService.approve(req.params.id, {
        overrides: req.body?.overrides,
        user: req.user,
      });

      await audit.record(req, {
        action: "create",
        resource: "member",
        resourceId: data.member?._id,
      });

      sendSuccess(res, {
        message: "Inscription validée. Le matricule a été attribué.",
        data,
      });
    })
  );

  adminSubmissions.post(
    "/:id/reject",
    requireRole("admin"),
    asyncHandler(async (req, res) => {
      const data = await submissionService.reject(req.params.id, {
        reason: req.body?.reason,
        user: req.user,
      });

      await audit.record(req, {
        action: "update",
        resource: "submission",
        resourceId: req.params.id,
      });

      sendSuccess(res, {
        message: "Demande rejetée.",
        data,
      });
    })
  );

  api.use("/admin/submissions", adminSubmissions);

```

- [ ] **Step 3: Vérifier manuellement**

Démarrer le backend (`npm run dev` depuis `backend/`), puis :

```bash
# Liste publique des bergeries (vide au départ) :
curl -s http://localhost:4000/api/flocks

# Soumission publique :
curl -s -X POST http://localhost:4000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"type":"new","data":{"firstName":"Awa","lastName":"Traoré","church":1,"flock":"000000000000000000000000","phone":"0700000000"}}'

# 6 envois consécutifs de la même commande : le 6e doit renvoyer un
# code 429 avec le message de submissionLimiter.
```

Résultat attendu : `GET /api/flocks` renvoie `{"success":true,"message":null,"data":[]}` (ou la liste si des bergeries existent déjà) ; la soumission renvoie `{"success":true,"message":"Votre demande a été transmise à l'équipe.","data":{"received":true}}` avec un code 201 ; le 6e envoi renvoie 429.

Vérifier ensuite le circuit admin avec un jeton valide (`TOKEN` obtenu via `POST /api/auth/login`) :

```bash
curl -s http://localhost:4000/api/admin/submissions -H "Authorization: Bearer $TOKEN"
```

Résultat attendu : la soumission créée ci-dessus apparaît dans `data`, avec `"status":"pending"`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middlewares/rateLimit.js backend/src/routes/index.js
git commit -m "feat(backend): monte les routes bergeries et soumissions"
```

---

### Task 6: Service et routes d'export Excel/PDF

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/services/memberExport.service.js`
- Modify: `backend/src/routes/index.js`

**Interfaces:**
- Consumes: `Member` (Task 3), `registrationNumber.service.js` (Task 2), `pdfkit` (déjà présent), nouvelle dépendance `exceljs`.
- Produces: `buildMembersXlsx(filter)`, `buildMembersPdf(filter)` (async, retournent un `Buffer`) ; routes `GET /api/admin/members/export.xlsx`, `GET /api/admin/members/export.pdf`.

- [ ] **Step 1: Installer la dépendance**

```bash
cd backend && npm install exceljs
```

- [ ] **Step 2: Écrire le service d'export**

```js
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import Member from "../models/Member.js";
import { formatRegistrationNumber } from "./registrationNumber.service.js";

const STATUS_LABELS = { actif: "Actif", inactif: "Inactif" };

const GREEN = "#0d5b3e";
const INK = "#1f2a25";

const fetchMembers = async (filter = {}) => {
  const criteria = {};

  if (filter.church) criteria.church = Number(filter.church);
  if (filter.flock) criteria.flock = filter.flock;
  if (filter.status) criteria.status = filter.status;

  return Member.find(criteria)
    .populate("flock", "name code")
    .sort({ church: 1, lastName: 1, firstName: 1 })
    .lean();
};

export const buildMembersXlsx = async (filter = {}) => {
  const members = await fetchMembers(filter);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Membres");

  sheet.columns = [
    { header: "Matricule", key: "registrationNumber", width: 18 },
    { header: "Nom", key: "lastName", width: 20 },
    { header: "Prénom", key: "firstName", width: 20 },
    { header: "Église", key: "church", width: 10 },
    { header: "Bergerie", key: "flock", width: 20 },
    { header: "Téléphone", key: "phone", width: 18 },
    { header: "Statut", key: "status", width: 12 },
    { header: "Date d'arrivée", key: "joinedAt", width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: "A1", to: "H1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const member of members) {
    sheet.addRow({
      registrationNumber: member.registrationNumber
        ? formatRegistrationNumber(member.registrationNumber)
        : "—",
      lastName: member.lastName,
      firstName: member.firstName,
      church: member.church ?? "—",
      flock: member.flock?.name ?? "—",
      phone: member.phone ?? "—",
      status: STATUS_LABELS[member.status] ?? member.status,
      joinedAt: member.joinedAt
        ? new Date(member.joinedAt).toLocaleDateString("fr-FR")
        : "—",
    });
  }

  return workbook.xlsx.writeBuffer();
};

export const buildMembersPdf = async (filter = {}) => {
  const members = await fetchMembers(filter);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(16)
      .fillColor(GREEN)
      .text("Centre Apostolique Vie et Abondance", { align: "center" });

    doc
      .fontSize(12)
      .fillColor(INK)
      .text("Registre des membres", { align: "center" })
      .moveDown(1);

    const columns = [
      { label: "N°", width: 30 },
      { label: "Matricule", width: 100 },
      { label: "Nom & prénoms", width: 220 },
      { label: "Bergerie", width: 120 },
    ];

    const drawHeader = () => {
      let x = doc.page.margins.left;
      const y = doc.y;

      doc.fontSize(9).fillColor(GREEN);

      for (const column of columns) {
        doc.text(column.label, x, y, { width: column.width });
        x += column.width;
      }

      doc.moveDown(0.5);
      doc.fillColor(INK);
    };

    drawHeader();

    members.forEach((member, index) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        drawHeader();
      }

      let x = doc.page.margins.left;
      const y = doc.y;
      const row = [
        String(index + 1).padStart(3, "0"),
        member.registrationNumber
          ? formatRegistrationNumber(member.registrationNumber)
          : "—",
        `${member.lastName} ${member.firstName}`.trim(),
        member.flock?.name ?? "—",
      ];

      columns.forEach((column, columnIndex) => {
        doc.fontSize(9).text(row[columnIndex], x, y, { width: column.width });
        x += column.width;
      });

      doc.moveDown(0.3);
    });

    doc.end();
  });
};
```

- [ ] **Step 3: Monter les routes d'export**

Dans `backend/src/routes/index.js`, ajouter l'import après celui de `submissionService` :

```js
import * as memberExportService from "../services/memberExport.service.js";
```

Puis, **avant** `mount("members", members, {...})` (juste après le bloc des routes de soumissions ajouté à la Task 5, donc toujours avant le montage de `members`) :

```js
  // Déclaré AVANT le montage de la ressource `members`, dont la route
  // GET /admin/members/:id intercepterait sinon "export.xlsx" comme un
  // identifiant — même piège que /donations/:reference/recu plus haut.
  const memberExportRouter = Router();

  memberExportRouter.use(requireAuth, requireRole("admin"));

  memberExportRouter.get(
    "/export.xlsx",
    asyncHandler(async (req, res) => {
      const buffer = await memberExportService.buildMembersXlsx({
        church: req.query.church,
        flock: req.query.flock,
        status: req.query.status,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="membres-cava.xlsx"'
      );

      res.send(buffer);
    })
  );

  memberExportRouter.get(
    "/export.pdf",
    asyncHandler(async (req, res) => {
      const buffer = await memberExportService.buildMembersPdf({
        church: req.query.church,
        flock: req.query.flock,
        status: req.query.status,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="registre-membres-cava.pdf"'
      );

      res.send(buffer);
    })
  );

  api.use("/admin/members", memberExportRouter);

```

- [ ] **Step 4: Vérifier manuellement**

Avec le backend démarré et un jeton admin valide :

```bash
curl -s -o membres.xlsx -w "%{http_code}\n" http://localhost:4000/api/admin/members/export.xlsx -H "Authorization: Bearer $TOKEN"
curl -s -o registre.pdf -w "%{http_code}\n" http://localhost:4000/api/admin/members/export.pdf -H "Authorization: Bearer $TOKEN"

# Sans jeton, doit échouer :
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/admin/members/export.xlsx

# Un ID réel de membre doit toujours fonctionner normalement (non
# intercepté par le nouveau routeur d'export) :
curl -s http://localhost:4000/api/admin/members/<un_id_reel> -H "Authorization: Bearer $TOKEN"
```

Résultat attendu : les deux premières commandes affichent `200`, produisent des fichiers non vides (`membres.xlsx` s'ouvre dans Excel/LibreOffice, `registre.pdf` s'ouvre dans un lecteur PDF) ; la requête sans jeton affiche `401` ; la requête sur un ID réel renvoie toujours la fiche du membre, pas une erreur.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/services/memberExport.service.js backend/src/routes/index.js
git commit -m "feat(backend): ajoute l'export Excel et PDF des membres"
```

---

## Frontend

### Task 7: Utilitaire de format de matricule et client API

**Files:**
- Create: `src/utils/registrationNumber.js`
- Modify: `src/services/api.js`

**Interfaces:**
- Produces: `letterForNumber`, `normalizeRegistrationNumber`, `formatRegistrationNumber`, `hasValidShape`, `hasValidControlLetter` (utilisées par Task 10, 12) ; `flocks` (collection CRUD) et `memberSubmissions` (`submit`, `list`, `get`, `approve`, `reject`) exportés de `services/api.js` (utilisés par Task 9, 10, 11, 12).

- [ ] **Step 1: Créer l'utilitaire de format (miroir du service backend)**

```js
// Miroir des fonctions pures de
// backend/src/services/registrationNumber.service.js.
//
// Dupliqué volontairement : le front et l'API n'ont pas de code
// partagé dans ce dépôt. Toute modification du format doit être
// répercutée des deux côtés.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^([1-5])([A-Z]{2})(\d{2})(\d{3})([A-Z])$/;

export const letterForNumber = (number) => ALPHABET[(number - 1) % 26];

export const normalizeRegistrationNumber = (input) =>
  String(input ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");

export const formatRegistrationNumber = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return canonical ?? "";

  const [, church, flockCode, year, number, letter] = match;

  return `${church}${flockCode} ${year}-${number} ${letter}`;
};

export const hasValidShape = (canonical) => SHAPE.test(canonical ?? "");

export const hasValidControlLetter = (canonical) => {
  const match = SHAPE.exec(canonical ?? "");

  if (!match) return false;

  const [, , , , number, letter] = match;

  return letter === letterForNumber(Number(number));
};
```

- [ ] **Step 2: Ajouter `flocks` et `memberSubmissions` au client API**

Dans `src/services/api.js`, ajouter après `export const testimonials = collection("testimonials");` (ligne 91) :

```js
export const flocks = collection("flocks");

// ---------------------------------------------------------------
// Inscriptions et mises à jour de fiche membre
// ---------------------------------------------------------------
export const memberSubmissions = {
  // Écriture PUBLIQUE : le formulaire d'inscription du site.
  submit: async (payload) =>
    request("/api/submissions", {
      method: "POST",
      body: payload,
    }),

  list: async (params = {}) =>
    requestWithMeta(
      `/api/admin/submissions?${new URLSearchParams({
        limit: 50,
        ...params,
      })}`,
      { auth: true }
    ),

  get: async (id) =>
    request(`/api/admin/submissions/${id}`, { auth: true }),

  approve: async (id, overrides) =>
    request(`/api/admin/submissions/${id}/approve`, {
      method: "POST",
      body: { overrides },
      auth: true,
    }),

  reject: async (id, reason) =>
    request(`/api/admin/submissions/${id}/reject`, {
      method: "POST",
      body: { reason },
      auth: true,
    }),
};
```

- [ ] **Step 3: Vérifier manuellement**

Créer temporairement un fichier `scratch.mjs` à la racine du projet :

```js
import {
  letterForNumber,
  normalizeRegistrationNumber,
  formatRegistrationNumber,
  hasValidShape,
  hasValidControlLetter,
} from "./src/utils/registrationNumber.js";

console.assert(letterForNumber(1) === "A");
console.assert(normalizeRegistrationNumber("1ol 16-005 e") === "1OL16005E");
console.assert(formatRegistrationNumber("1OL16005E") === "1OL 16-005 E");
console.assert(hasValidShape("1OL16005E") === true);
console.assert(hasValidShape("PASDUTOUT") === false);
console.assert(hasValidControlLetter("1OL16005E") === true);
console.assert(hasValidControlLetter("1OL16005Z") === false);

console.log("OK");
```

Lancer : `node scratch.mjs` — résultat attendu : `OK` sans message `Assertion failed`. Supprimer le fichier ensuite (`rm scratch.mjs`).

Puis vérifier `npm run build` (à la racine) : doit se terminer sans erreur — confirme que `api.js` reste syntaxiquement valide.

- [ ] **Step 4: Commit**

```bash
git add src/utils/registrationNumber.js src/services/api.js
git commit -m "feat(frontend): ajoute l'utilitaire matricule et le client API des inscriptions"
```

---

### Task 8: Contexte et données du tunnel d'inscription

**Files:**
- Create: `src/context/RegistrationContext.jsx`
- Create: `src/components/registration/RegistrationForm/data.js`

**Interfaces:**
- Consumes: `normalizeRegistrationNumber` (Task 7).
- Produces: `RegistrationProvider`, `useRegistration()` (context React) ; `CHURCHES`, `churchLabel`, `GENDERS`, `MARITAL_STATUSES`, `steps`, `validateStep(step, state)`, `buildSubmissionPayload(state)` — utilisés par Task 9 et 10.

- [ ] **Step 1: Créer le contexte**

Calqué sur `src/context/ContributionContext.jsx` (déjà existant pour le tunnel de don) :

```jsx
import {
  createContext,
  useContext,
  useReducer,
} from "react";

const RegistrationContext = createContext();

export const initialState = {
  // "new" : jamais inscrit. "update" : porteur d'un matricule déjà
  // attribué (papier ou informatisé), qui vient compléter ou corriger
  // sa fiche.
  kind: "new",

  submittedRegistrationNumber: "",

  data: {
    firstName: "",
    lastName: "",
    church: "",
    flock: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    childrenCount: "",
    conversionYear: "",
    baptismWater: false,
    baptismWaterYear: "",
    baptismHolySpirit: false,
    previousChurch: "",
    profession: "",
    skills: "",
    desiredDepartment: "",
    availability: "",
  },
};

function registrationReducer(state, action) {
  switch (action.type) {
    case "SET_KIND":
      return { ...state, kind: action.payload };

    case "SET_SUBMITTED_REGISTRATION_NUMBER":
      return { ...state, submittedRegistrationNumber: action.payload };

    case "UPDATE_DATA":
      return { ...state, data: { ...state.data, ...action.payload } };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export const RegistrationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(
    registrationReducer,
    initialState
  );

  return (
    <RegistrationContext.Provider value={{ state, dispatch }}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = () => useContext(RegistrationContext);
```

- [ ] **Step 2: Créer les données et la validation du tunnel**

```js
// Données et libellés du tunnel d'inscription.
//
// Extraits du composant pour qu'il ne porte que l'orchestration —
// même découpage que ContributionForm/data.js côté page Don.

import { normalizeRegistrationNumber } from "../../../utils/registrationNumber";

// Les 5 églises du réseau ne changent pratiquement jamais : liste
// codée en dur, comme MEMBER_ROLES dans CommunityAdmin.jsx. À adapter
// ici si les noms réels des églises diffèrent de ces libellés
// génériques.
export const CHURCHES = [
  { value: 1, label: "Église 1" },
  { value: 2, label: "Église 2" },
  { value: 3, label: "Église 3" },
  { value: 4, label: "Église 4" },
  { value: 5, label: "Église 5" },
];

export const churchLabel = (value) =>
  CHURCHES.find((church) => church.value === Number(value))?.label ??
  `Église ${value}`;

export const GENDERS = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
];

export const MARITAL_STATUSES = [
  { value: "celibataire", label: "Célibataire" },
  { value: "marie", label: "Marié(e)" },
  { value: "veuf", label: "Veuf / veuve" },
  { value: "divorce", label: "Divorcé(e)" },
];

export const steps = [
  "Matricule",
  "Identité",
  "Contact",
  "État civil",
  "Vie spirituelle",
  "Engagement",
  "Récapitulatif",
];

export const validateStep = (step, state) => {
  if (
    step === 0 &&
    state.kind === "update" &&
    !state.submittedRegistrationNumber.trim()
  ) {
    return "Merci de saisir votre matricule.";
  }

  if (step === 1) {
    if (!state.data.firstName.trim()) {
      return "Merci d'indiquer votre prénom.";
    }

    if (!state.data.lastName.trim()) {
      return "Merci d'indiquer votre nom.";
    }

    if (!state.data.church) {
      return "Merci de choisir votre église.";
    }

    if (!state.data.flock) {
      return "Merci de choisir votre bergerie.";
    }
  }

  if (step === 2 && !state.data.phone.trim()) {
    return "Merci d'indiquer un numéro de téléphone.";
  }

  return "";
};

export const buildSubmissionPayload = (state) => ({
  type: state.kind,
  registrationNumber:
    state.kind === "update"
      ? normalizeRegistrationNumber(state.submittedRegistrationNumber)
      : undefined,
  data: {
    firstName: state.data.firstName.trim(),
    lastName: state.data.lastName.trim(),
    church: Number(state.data.church),
    flock: state.data.flock,
    phone: state.data.phone.trim(),
    whatsapp: state.data.whatsapp.trim(),
    email: state.data.email.trim(),
    address: state.data.address.trim(),
    emergencyContact: {
      name: state.data.emergencyContactName.trim(),
      phone: state.data.emergencyContactPhone.trim(),
    },
    dateOfBirth: state.data.dateOfBirth || undefined,
    gender: state.data.gender || undefined,
    maritalStatus: state.data.maritalStatus || undefined,
    childrenCount:
      state.data.childrenCount !== ""
        ? Number(state.data.childrenCount)
        : undefined,
    conversionYear:
      state.data.conversionYear !== ""
        ? Number(state.data.conversionYear)
        : undefined,
    baptism: {
      water: state.data.baptismWater,
      waterYear:
        state.data.baptismWaterYear !== ""
          ? Number(state.data.baptismWaterYear)
          : undefined,
      holySpirit: state.data.baptismHolySpirit,
    },
    previousChurch: state.data.previousChurch.trim(),
    profession: state.data.profession.trim(),
    skills: state.data.skills
      ? state.data.skills
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    desiredDepartment: state.data.desiredDepartment.trim(),
    availability: state.data.availability.trim(),
  },
});
```

- [ ] **Step 2: Vérifier manuellement**

`npm run build` (à la racine) doit se terminer sans erreur — confirme que les deux fichiers sont syntaxiquement valides et que les imports résolvent correctement (`normalizeRegistrationNumber` depuis Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/context/RegistrationContext.jsx src/components/registration/RegistrationForm/data.js
git commit -m "feat(frontend): ajoute le contexte et les donnees du tunnel d'inscription"
```

---

### Task 9: Composants d'étapes et orchestrateur du formulaire

**Files:**
- Create: `src/components/registration/RegistrationForm/StepLookup.jsx`
- Create: `src/components/registration/RegistrationForm/StepIdentity.jsx`
- Create: `src/components/registration/RegistrationForm/StepContact.jsx`
- Create: `src/components/registration/RegistrationForm/StepCivilStatus.jsx`
- Create: `src/components/registration/RegistrationForm/StepSpiritualLife.jsx`
- Create: `src/components/registration/RegistrationForm/StepEngagement.jsx`
- Create: `src/components/registration/RegistrationForm/StepSummary.jsx`
- Create: `src/components/registration/RegistrationForm/index.jsx`
- Create: `src/components/registration/RegistrationForm/RegistrationForm.scss`

**Interfaces:**
- Consumes: `useRegistration` (Task 8), `steps`/`validateStep`/`buildSubmissionPayload`/`CHURCHES`/`churchLabel`/`GENDERS`/`MARITAL_STATUSES` (Task 8), `flocks`/`memberSubmissions` (Task 7), `hasValidShape`/`hasValidControlLetter`/`formatRegistrationNumber`/`normalizeRegistrationNumber` (Task 7).
- Produces: `<RegistrationForm />` (composant par défaut) — utilisé par Task 11.

- [ ] **Step 1: `StepLookup.jsx` — choix nouveau / matricule existant**

```jsx
import {
  hasValidShape,
  hasValidControlLetter,
  formatRegistrationNumber,
  normalizeRegistrationNumber,
} from "../../../utils/registrationNumber";

const StepLookup = ({ state, dispatch }) => {
  const raw = state.submittedRegistrationNumber;
  const normalized = normalizeRegistrationNumber(raw);
  const showWarning =
    normalized.length > 0 &&
    (!hasValidShape(normalized) || !hasValidControlLetter(normalized));

  return (
    <div className="step-panel">
      <div className="form-group">
        <label>Votre situation</label>

        <div className="kind-grid">
          <button
            type="button"
            className={state.kind === "new" ? "active" : ""}
            onClick={() => dispatch({ type: "SET_KIND", payload: "new" })}
          >
            Je suis nouveau
          </button>

          <button
            type="button"
            className={state.kind === "update" ? "active" : ""}
            onClick={() => dispatch({ type: "SET_KIND", payload: "update" })}
          >
            J&apos;ai déjà un matricule
          </button>
        </div>
      </div>

      {state.kind === "update" && (
        <div className="form-group">
          <label htmlFor="registration-number">Votre matricule</label>

          <input
            id="registration-number"
            type="text"
            placeholder="1OL 16-005 E"
            value={raw}
            onChange={(event) =>
              dispatch({
                type: "SET_SUBMITTED_REGISTRATION_NUMBER",
                payload: event.target.value,
              })
            }
          />

          {normalized && !showWarning && (
            <p className="registration-preview">
              Format reconnu : {formatRegistrationNumber(normalized)}
            </p>
          )}

          {showWarning && (
            <p className="registration-warning">
              Ce format ne ressemble pas à un matricule CAVA valide.
              Vous pouvez continuer : l&apos;équipe vérifiera à la
              réception de votre demande.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default StepLookup;
```

- [ ] **Step 2: `StepIdentity.jsx` — identité, église, bergerie**

```jsx
import { useEffect, useState } from "react";

import { flocks as flocksApi } from "../../../services/api";
import { CHURCHES } from "./data";

const StepIdentity = ({ state, updateData }) => {
  const [flockOptions, setFlockOptions] = useState([]);
  const [loadingFlocks, setLoadingFlocks] = useState(false);

  useEffect(() => {
    if (!state.data.church) {
      setFlockOptions([]);

      return;
    }

    let cancelled = false;

    setLoadingFlocks(true);

    flocksApi
      .list({ church: state.data.church })
      .then((items) => {
        if (!cancelled) setFlockOptions(items);
      })
      .catch(() => {
        if (!cancelled) setFlockOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFlocks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state.data.church]);

  return (
    <div className="step-panel">
      <div className="form-group">
        <label htmlFor="reg-firstName">Prénom</label>
        <input
          id="reg-firstName"
          type="text"
          value={state.data.firstName}
          onChange={(event) => updateData({ firstName: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="reg-lastName">Nom</label>
        <input
          id="reg-lastName"
          type="text"
          value={state.data.lastName}
          onChange={(event) => updateData({ lastName: event.target.value })}
        />
      </div>

      <div className="form-group">
        <label htmlFor="reg-church">Église</label>
        <select
          id="reg-church"
          value={state.data.church}
          onChange={(event) =>
            updateData({ church: event.target.value, flock: "" })
          }
        >
          <option value="">—</option>
          {CHURCHES.map((church) => (
            <option key={church.value} value={church.value}>
              {church.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="reg-flock">Bergerie</label>
        <select
          id="reg-flock"
          value={state.data.flock}
          onChange={(event) => updateData({ flock: event.target.value })}
          disabled={!state.data.church || loadingFlocks}
        >
          <option value="">
            {state.data.church ? "—" : "Choisissez d'abord une église"}
          </option>
          {flockOptions.map((flock) => (
            <option key={flock.id} value={flock.id}>
              {flock.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default StepIdentity;
```

- [ ] **Step 3: `StepContact.jsx`**

```jsx
const StepContact = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-phone">Téléphone</label>
      <input
        id="reg-phone"
        type="tel"
        placeholder="+225 07 00 00 00 00"
        value={state.data.phone}
        onChange={(event) => updateData({ phone: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-whatsapp">WhatsApp</label>
      <input
        id="reg-whatsapp"
        type="tel"
        placeholder="Si différent du téléphone"
        value={state.data.whatsapp}
        onChange={(event) => updateData({ whatsapp: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-email">E-mail</label>
      <input
        id="reg-email"
        type="email"
        value={state.data.email}
        onChange={(event) => updateData({ email: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-address">Adresse</label>
      <input
        id="reg-address"
        type="text"
        placeholder="Angré 7e tranche"
        value={state.data.address}
        onChange={(event) => updateData({ address: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label>Personne à prévenir en cas d&apos;urgence</label>

      <div className="contact-grid">
        <input
          type="text"
          placeholder="Nom"
          aria-label="Nom de la personne à prévenir"
          value={state.data.emergencyContactName}
          onChange={(event) =>
            updateData({ emergencyContactName: event.target.value })
          }
        />

        <input
          type="tel"
          placeholder="Téléphone"
          aria-label="Téléphone de la personne à prévenir"
          value={state.data.emergencyContactPhone}
          onChange={(event) =>
            updateData({ emergencyContactPhone: event.target.value })
          }
        />
      </div>
    </div>
  </div>
);

export default StepContact;
```

- [ ] **Step 4: `StepCivilStatus.jsx`**

```jsx
import { GENDERS, MARITAL_STATUSES } from "./data";

const StepCivilStatus = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-dob">Date de naissance</label>
      <input
        id="reg-dob"
        type="date"
        value={state.data.dateOfBirth}
        onChange={(event) => updateData({ dateOfBirth: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-gender">Genre</label>
      <select
        id="reg-gender"
        value={state.data.gender}
        onChange={(event) => updateData({ gender: event.target.value })}
      >
        <option value="">—</option>
        {GENDERS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="reg-marital">Situation matrimoniale</label>
      <select
        id="reg-marital"
        value={state.data.maritalStatus}
        onChange={(event) =>
          updateData({ maritalStatus: event.target.value })
        }
      >
        <option value="">—</option>
        {MARITAL_STATUSES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="reg-children">Nombre d&apos;enfants</label>
      <input
        id="reg-children"
        type="number"
        min="0"
        max="30"
        value={state.data.childrenCount}
        onChange={(event) =>
          updateData({ childrenCount: event.target.value })
        }
      />
    </div>
  </div>
);

export default StepCivilStatus;
```

- [ ] **Step 5: `StepSpiritualLife.jsx`**

```jsx
const StepSpiritualLife = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-conversion">Année de conversion</label>
      <input
        id="reg-conversion"
        type="number"
        min="1900"
        max="2100"
        value={state.data.conversionYear}
        onChange={(event) =>
          updateData({ conversionYear: event.target.value })
        }
      />
    </div>

    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.data.baptismWater}
          onChange={(event) =>
            updateData({ baptismWater: event.target.checked })
          }
        />
        Baptisé(e) d&apos;eau
      </label>

      {state.data.baptismWater && (
        <input
          type="number"
          min="1900"
          max="2100"
          placeholder="Année du baptême"
          aria-label="Année du baptême d'eau"
          value={state.data.baptismWaterYear}
          onChange={(event) =>
            updateData({ baptismWaterYear: event.target.value })
          }
        />
      )}
    </div>

    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.data.baptismHolySpirit}
          onChange={(event) =>
            updateData({ baptismHolySpirit: event.target.checked })
          }
        />
        Baptisé(e) du Saint-Esprit
      </label>
    </div>

    <div className="form-group">
      <label htmlFor="reg-previous-church">Église précédente</label>
      <input
        id="reg-previous-church"
        type="text"
        placeholder="Facultatif"
        value={state.data.previousChurch}
        onChange={(event) =>
          updateData({ previousChurch: event.target.value })
        }
      />
    </div>
  </div>
);

export default StepSpiritualLife;
```

- [ ] **Step 6: `StepEngagement.jsx`**

```jsx
const StepEngagement = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-profession">Profession</label>
      <input
        id="reg-profession"
        type="text"
        value={state.data.profession}
        onChange={(event) => updateData({ profession: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-skills">Compétences</label>
      <input
        id="reg-skills"
        type="text"
        placeholder="Musique, informatique, accueil…"
        value={state.data.skills}
        onChange={(event) => updateData({ skills: event.target.value })}
      />
      <p className="field-help">
        Séparez chaque compétence par une virgule.
      </p>
    </div>

    <div className="form-group">
      <label htmlFor="reg-department">Département souhaité</label>
      <input
        id="reg-department"
        type="text"
        placeholder="Louange, accueil, intercession…"
        value={state.data.desiredDepartment}
        onChange={(event) =>
          updateData({ desiredDepartment: event.target.value })
        }
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-availability">Disponibilités</label>
      <input
        id="reg-availability"
        type="text"
        placeholder="Samedi après-midi, dimanche matin…"
        value={state.data.availability}
        onChange={(event) =>
          updateData({ availability: event.target.value })
        }
      />
    </div>
  </div>
);

export default StepEngagement;
```

- [ ] **Step 7: `StepSummary.jsx`**

```jsx
import { churchLabel, GENDERS, MARITAL_STATUSES } from "./data";

const labelFor = (list, value) =>
  list.find((item) => item.value === value)?.label ?? "—";

const StepSummary = ({ state }) => (
  <div className="step-panel">
    <div className="summary-block">
      <h3>Votre demande</h3>

      <dl className="summary-list">
        <div>
          <dt>Type</dt>
          <dd>
            {state.kind === "new"
              ? "Nouvelle inscription"
              : `Mise à jour du matricule ${state.submittedRegistrationNumber}`}
          </dd>
        </div>

        <div>
          <dt>Nom complet</dt>
          <dd>
            {state.data.firstName} {state.data.lastName}
          </dd>
        </div>

        <div>
          <dt>Église</dt>
          <dd>{churchLabel(state.data.church)}</dd>
        </div>

        <div>
          <dt>Téléphone</dt>
          <dd>{state.data.phone || "—"}</dd>
        </div>

        <div>
          <dt>Genre</dt>
          <dd>{labelFor(GENDERS, state.data.gender)}</dd>
        </div>

        <div>
          <dt>Situation matrimoniale</dt>
          <dd>{labelFor(MARITAL_STATUSES, state.data.maritalStatus)}</dd>
        </div>

        <div>
          <dt>Profession</dt>
          <dd>{state.data.profession || "—"}</dd>
        </div>
      </dl>

      <p className="summary-note">
        Vérifiez vos informations avant l&apos;envoi. Vous pouvez
        revenir en arrière tant que vous n&apos;avez pas cliqué sur
        « Envoyer ma demande ».
      </p>
    </div>
  </div>
);

export default StepSummary;
```

- [ ] **Step 8: `index.jsx` — orchestrateur**

Calqué sur `src/components/donate/ContributionForm/index.jsx` :

```jsx
import { useState } from "react";

import { FaArrowRight, FaArrowLeft, FaCheck } from "react-icons/fa";

import { useRegistration } from "../../../context/RegistrationContext";
import { steps, validateStep, buildSubmissionPayload } from "./data";
import { memberSubmissions } from "../../../services/api";

import StepLookup from "./StepLookup";
import StepIdentity from "./StepIdentity";
import StepContact from "./StepContact";
import StepCivilStatus from "./StepCivilStatus";
import StepSpiritualLife from "./StepSpiritualLife";
import StepEngagement from "./StepEngagement";
import StepSummary from "./StepSummary";

import "./RegistrationForm.scss";

const RegistrationForm = () => {
  const { state, dispatch } = useRegistration();

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isLastStep = step === steps.length - 1;

  const clearError = () => {
    if (error) setError("");
  };

  const updateData = (patch) => {
    dispatch({ type: "UPDATE_DATA", payload: patch });
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

  const handleSubmit = async () => {
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      await memberSubmissions.submit(buildSubmissionPayload(state));

      setSubmitted(true);
    } catch (submitError) {
      const details = submitError.details
        ? Object.values(submitError.details)[0]
        : null;

      setError(
        details ??
          submitError.message ??
          "L'envoi a échoué. Merci de réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="registration-form">
        <div className="registration-form__done">
          <FaCheck aria-hidden="true" />
          <h2>Votre demande a été transmise à l&apos;équipe.</h2>
          <p>
            Un responsable vérifiera votre inscription. Vous
            n&apos;avez rien d&apos;autre à faire pour le moment.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="registration-form" id="registration-form">
      <div className="registration-form__container">
        <ol className="steps" aria-label="Étapes de l'inscription">
          {steps.map((label, index) => (
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
                {index < step ? (
                  <FaCheck aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>

              <span className="steps__label">{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 && <StepLookup state={state} dispatch={dispatch} />}
        {step === 1 && (
          <StepIdentity state={state} updateData={updateData} />
        )}
        {step === 2 && <StepContact state={state} updateData={updateData} />}
        {step === 3 && (
          <StepCivilStatus state={state} updateData={updateData} />
        )}
        {step === 4 && (
          <StepSpiritualLife state={state} updateData={updateData} />
        )}
        {step === 5 && (
          <StepEngagement state={state} updateData={updateData} />
        )}
        {step === 6 && <StepSummary state={state} />}

        {error && (
          <p className="step-error" role="alert">
            {error}
          </p>
        )}

        <div className="step-nav">
          {step > 0 && (
            <button
              type="button"
              className="step-nav__back"
              onClick={goBack}
            >
              <FaArrowLeft aria-hidden="true" />
              Retour
            </button>
          )}

          {!isLastStep && (
            <button
              type="button"
              className="step-nav__next"
              onClick={goNext}
            >
              Suivant
              <FaArrowRight aria-hidden="true" />
            </button>
          )}

          {isLastStep && (
            <button
              type="button"
              className="step-nav__next"
              onClick={handleSubmit}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Envoi…" : "Envoyer ma demande"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default RegistrationForm;
```

- [ ] **Step 9: `RegistrationForm.scss`**

Chaque sélecteur est imbriqué sous `.registration-form` — jamais déclaré à la racine du fichier (voir la mise en garde de `CLAUDE.md`) :

```scss
@use "../../../styles/variables" as *;

.registration-form {
  padding: 80px 0;

  background: linear-gradient(180deg, #fafaf8 0%, #f4f8f5 100%);

  &__container {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 0 20px;

    background: #fff;
    border-radius: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.06);

    padding: 42px;
  }

  &__done {
    text-align: center;
    padding: 60px 20px;

    svg {
      font-size: 2.5rem;
      color: $primary;
      margin-bottom: 16px;
    }

    h2 {
      color: $primary-dark;
      margin: 0 0 10px;
    }
  }
}

.registration-form .steps {
  list-style: none;
  margin: 0 0 30px;
  padding: 0;

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;

    color: #9aa3ab;
    font-size: 0.82rem;
    font-weight: 600;

    &--current {
      color: $primary;

      .steps__bullet {
        background: $primary;
        color: #fff;
      }
    }

    &--done {
      color: $primary;

      .steps__bullet {
        background: $secondary;
        color: #1f2937;
      }
    }
  }

  &__bullet {
    width: 28px;
    height: 28px;
    border-radius: 50%;

    background: #e5e7eb;
    color: #6b7280;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 0.8rem;
    font-weight: 700;

    flex-shrink: 0;
  }
}

.registration-form .step-panel {
  .form-group {
    margin-bottom: 26px;

    label {
      display: block;
      margin-bottom: 10px;
      font-weight: 700;
      color: #111;
    }

    input,
    select,
    textarea {
      width: 100%;
      min-height: 52px;
      padding: 0 16px;

      border: 2px solid transparent;
      border-radius: 14px;

      background: #f8faf9;
      font-size: 1rem;

      &:focus {
        outline: none;
        background: #fff;
        border-color: $primary;
      }
    }

    textarea {
      padding: 12px 16px;
    }
  }

  .checkbox {
    display: flex !important;
    align-items: center;
    gap: 10px;

    font-weight: 500 !important;
    cursor: pointer;

    input {
      width: 18px !important;
      height: 18px !important;
      margin: 0;
    }
  }

  .field-help {
    margin: 8px 0 0;
    color: #6b7280;
    font-size: 0.85rem;
  }

  .kind-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    button {
      height: 60px;
      border: 2px solid #eef1ef;
      border-radius: 14px;
      background: #fff;
      font-weight: 700;
      cursor: pointer;

      &.active {
        background: $primary;
        color: #fff;
        border-color: transparent;
      }
    }
  }

  .contact-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .registration-preview {
    margin-top: 8px;
    color: $primary;
    font-weight: 600;
  }

  .registration-warning {
    margin-top: 8px;
    padding: 10px 14px;
    border-left: 4px solid $secondary-dark;
    border-radius: 8px;
    background: rgba(154, 123, 5, 0.08);
    color: #6b5405;
    font-size: 0.88rem;
  }
}

.registration-form .summary-block {
  h3 {
    color: $primary-dark;
    margin: 0 0 18px;
  }

  .summary-list {
    display: grid;
    gap: 14px;
    margin: 0 0 20px;

    div {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #eef1ef;
      padding-bottom: 10px;
    }

    dt {
      color: #6b7280;
    }

    dd {
      margin: 0;
      font-weight: 700;
      text-align: right;
    }
  }

  .summary-note {
    color: #6b7280;
    font-size: 0.85rem;
  }
}

.registration-form .step-error {
  margin: 0 0 18px;
  padding: 12px 14px;
  border-left: 4px solid #c0392b;
  border-radius: 8px;
  background: rgba(192, 57, 43, 0.08);
  color: #c0392b;
  font-weight: 600;
}

.registration-form .step-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 10px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 10px;

    padding: 14px 26px;
    border: none;
    border-radius: 12px;

    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }
  }

  &__back {
    background: transparent;
    border: 1px solid #d1d5db !important;
    color: #4b5563;
  }

  &__next {
    margin-left: auto;
    background: $primary;
    color: #fff;
  }
}

@media (max-width: 768px) {
  .registration-form {
    padding: 50px 0;

    &__container {
      padding: 26px;
    }
  }

  .registration-form .step-panel {
    .kind-grid,
    .contact-grid {
      grid-template-columns: 1fr;
    }
  }

  .registration-form .steps__label {
    display: none;
  }
}
```

- [ ] **Step 10: Vérifier manuellement**

`npm run build` (à la racine) — doit se terminer sans erreur. Puis `npm run dev` et, une fois Task 11 branchée sur une page (voir plus bas), naviguer manuellement le tunnel entier dans le navigateur : chaque étape doit s'afficher, la validation doit bloquer un passage à l'étape suivante si un champ obligatoire manque, et le bouton « Retour » doit fonctionner. Cette vérification complète en navigateur n'est possible qu'après Task 11 (la page qui monte ce composant) — à défaut, vérifier ici uniquement l'absence d'erreur de build et l'absence d'avertissement ESLint (`npm run lint`).

- [ ] **Step 11: Commit**

```bash
git add src/components/registration/RegistrationForm
git commit -m "feat(frontend): ajoute les etapes et l'orchestrateur du formulaire d'inscription"
```

---

### Task 10: Page d'inscription, route et lien de navigation

**Files:**
- Create: `src/pages/Registration/Registration.jsx`
- Create: `src/pages/Registration/Registration.scss`
- Modify: `src/routes/AppRoutes.jsx`
- Modify: `src/components/Navbar/Navbar.jsx`

**Interfaces:**
- Consumes: `RegistrationProvider` (Task 8), `RegistrationForm` (Task 9), `Navbar`, `Footer`, `usePageMeta` (existants).
- Produces: route publique `/inscription`.

- [ ] **Step 1: Créer la page**

```jsx
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import { RegistrationProvider } from "../../context/RegistrationContext";
import RegistrationForm from "../../components/registration/RegistrationForm";

import "./Registration.scss";

const Registration = () => {
  usePageMeta({
    title: "Inscription des membres",
    description:
      "Inscrivez-vous comme nouveau membre du Centre Apostolique Vie et Abondance, ou mettez à jour votre fiche si vous possédez déjà un matricule.",
  });

  return (
    <>
      <Navbar />

      <section className="registration-hero">
        <div className="registration-hero__container">
          <h1>Devenir membre</h1>

          <p>
            Que vous rejoigniez la famille CAVA pour la première fois
            ou que vous possédiez déjà un matricule, cette page vous
            permet de déclarer ou de mettre à jour vos informations.
            Une équipe vérifie chaque demande avant son enregistrement
            définitif.
          </p>
        </div>
      </section>

      <RegistrationProvider>
        <RegistrationForm />
      </RegistrationProvider>

      <Footer />
    </>
  );
};

export default Registration;
```

- [ ] **Step 2: Styliser le bandeau d'introduction**

```scss
@use "../../styles/variables" as *;
@use "../../styles/mixins" as *;

.registration-hero {
  padding: 70px 0 30px;
  text-align: center;

  background: $primary-dark;
  color: #fff;

  &__container {
    @include container;

    max-width: 760px;

    h1 {
      margin: 0 0 16px;
      font-size: 2.4rem;
      font-weight: 800;
    }

    p {
      margin: 0;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.6;
    }
  }
}

@media (max-width: 768px) {
  .registration-hero {
    padding: 50px 0 20px;

    &__container h1 {
      font-size: 1.8rem;
    }
  }
}
```

- [ ] **Step 3: Ajouter la route**

Dans `src/routes/AppRoutes.jsx`, ajouter l'import après `import Donate from "../pages/Donate/Donate";` (ligne 12) :

```js
import Registration from "../pages/Registration/Registration";
```

Puis ajouter la route, après la route `/donate` et avant `/donate/retour` (ou à tout autre endroit parmi les routes publiques, l'ordre n'a pas d'incidence ici) :

```jsx
      <Route
        path="/inscription"
        element={<Registration />}
      />

```

- [ ] **Step 4: Ajouter le lien dans la navigation**

Dans `src/components/Navbar/Navbar.jsx` :

1. Ajouter `UserPlus` à l'import `lucide-react` (ligne 3-14) :

```js
import {
  Menu,
  X,
  Heart,
  Home,
  Info,
  Church,
  Calendar,
  PlayCircle,
  Users,
  Phone,
  UserPlus
} from "lucide-react";
```

2. Dans `<nav className="navbar__desktop">`, ajouter avant `<NavLink to="/contact">` (ligne 78) :

```jsx
          <NavLink to="/inscription">
            Devenir membre
          </NavLink>

```

3. Dans `<nav className={\`navbar__mobile ...\`}>`, ajouter avant `<NavLink to="/contact" onClick={closeMenu}>` (ligne 144) :

```jsx
            <NavLink to="/inscription" onClick={closeMenu}>
              <UserPlus size={20} />
              <span>Devenir membre</span>
            </NavLink>

```

- [ ] **Step 5: Vérifier manuellement**

```bash
npm run build
npm run lint
npm run dev
```

Dans le navigateur (`http://localhost:5173` ou le port indiqué) :
1. Ouvrir la barre de navigation (desktop et mobile) : le lien « Devenir membre » doit apparaître et mener vers `/inscription`.
2. Sur `/inscription`, dérouler tout le tunnel : choisir « Je suis nouveau », remplir identité (nécessite qu'au moins une bergerie existe en base pour l'église choisie — sinon le menu bergerie reste vide, ce qui est le comportement attendu tant que Task 12 n'a pas permis d'en créer une), contact, état civil, vie spirituelle, engagement, puis récapitulatif.
3. Cliquer « Envoyer ma demande » : l'écran de confirmation neutre doit s'afficher (« Votre demande a été transmise à l'équipe. »), sans jamais révéler si un matricule existant a été trouvé.
4. Recharger `/api/admin/submissions` côté admin (ou `curl`) : la demande doit apparaître avec `status: "pending"`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Registration src/routes/AppRoutes.jsx src/components/Navbar/Navbar.jsx
git commit -m "feat(frontend): ajoute la page d'inscription publique et son lien de navigation"
```

---

### Task 11: Panneau d'administration des inscriptions en attente

**Files:**
- Create: `src/components/admin/SubmissionsPanel/index.jsx`
- Create: `src/components/admin/SubmissionsPanel/SubmissionsPanel.scss`

**Interfaces:**
- Consumes: `memberSubmissions`, `flocks` (Task 7), `useAsyncData` (existant), `AdminModal`, `AdminEmpty`/`AdminError`/`AdminLoading` (existants), `churchLabel` (Task 8).
- Produces: `<SubmissionsPanel />` — utilisé par Task 12.

- [ ] **Step 1: Écrire le composant**

```jsx
import { useEffect, useState } from "react";

import { CheckCircle2, XCircle } from "lucide-react";

import { memberSubmissions, flocks as flocksApi } from "../../../services/api";

import useAsyncData from "../../../hooks/useAsyncData";

import AdminModal from "../AdminModal";
import { AdminEmpty, AdminError, AdminLoading } from "../AdminFeedback";

import { churchLabel } from "../../registration/RegistrationForm/data";

import "./SubmissionsPanel.scss";

const FIELD_LABELS = {
  firstName: "Prénom",
  lastName: "Nom",
  email: "E-mail",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  address: "Adresse",
  church: "Église",
  flock: "Bergerie",
  dateOfBirth: "Date de naissance",
  gender: "Genre",
  maritalStatus: "Situation matrimoniale",
  childrenCount: "Nombre d'enfants",
  conversionYear: "Année de conversion",
  previousChurch: "Église précédente",
  profession: "Profession",
  desiredDepartment: "Département souhaité",
  availability: "Disponibilités",
};

const KIND_LABELS = { new: "Nouveau", update: "Mise à jour" };

const EDITABLE_FIELDS = ["firstName", "lastName", "phone", "email"];

const formatValue = (field, value, flockNames) => {
  if (value === undefined || value === null || value === "") return "—";

  if (field === "church") return churchLabel(value);
  if (field === "flock") return flockNames[value] ?? String(value);
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
};

const diffFields = (before = {}, after = {}, flockNames) =>
  Object.keys(FIELD_LABELS)
    .map((field) => ({
      field,
      label: FIELD_LABELS[field],
      before: formatValue(field, before[field], flockNames),
      after: formatValue(field, after[field], flockNames),
    }))
    .filter((row) => row.before !== row.after);

const SubmissionsPanel = () => {
  const { data, loading, error, reload } = useAsyncData(
    memberSubmissions.list
  );

  const [flockNames, setFlockNames] = useState({});
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [overrides, setOverrides] = useState({});
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    flocksApi
      .listAdmin({ limit: 200 })
      .then((items) => {
        const map = {};

        for (const item of items) map[item.id] = item.name;

        setFlockNames(map);
      })
      .catch(() => setFlockNames({}));
  }, []);

  const items = data?.items ?? [];

  const openDetail = async (submission) => {
    const id = submission.id ?? submission._id;

    setSelected(submission);
    setDetail(null);
    setDetailError("");
    setActionError("");
    setOverrides({});
    setRejecting(false);
    setRejectReason("");

    try {
      const result = await memberSubmissions.get(id);

      setDetail(result);
    } catch (caught) {
      setDetailError(
        caught?.message ?? "Impossible de charger la demande."
      );
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const selectedId = () => selected?.id ?? selected?._id;

  const handleApprove = async () => {
    setBusy(true);
    setActionError("");

    try {
      await memberSubmissions.approve(selectedId(), overrides);

      closeDetail();
      reload();
    } catch (caught) {
      setActionError(caught?.message ?? "La validation a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setActionError("");

    try {
      await memberSubmissions.reject(selectedId(), rejectReason);

      closeDetail();
      reload();
    } catch (caught) {
      setActionError(caught?.message ?? "Le rejet a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const isUpdate = detail?.submission.type === "update";

  const rows = detail
    ? isUpdate && detail.currentMember
      ? diffFields(detail.currentMember, detail.submission.data, flockNames)
      : Object.keys(FIELD_LABELS).map((field) => ({
          field,
          label: FIELD_LABELS[field],
          before: null,
          after: formatValue(
            field,
            detail.submission.data[field],
            flockNames
          ),
        }))
    : [];

  return (
    <section className="submissions-panel">
      <header className="submissions-panel__header">
        <div>
          <h1>Inscriptions en attente</h1>

          <p>
            Demandes envoyées depuis le site public. Rien n&apos;est
            enregistré dans l&apos;annuaire des membres tant
            qu&apos;une demande n&apos;est pas validée ici.
          </p>
        </div>
      </header>

      <div aria-busy={loading}>
        {loading && <AdminLoading label="Chargement des demandes…" />}

        {!loading && error && (
          <AdminError message={error} onRetry={reload} />
        )}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="Aucune demande en attente pour le moment." />
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="submissions-panel__list">
            {items.map((submission) => (
              <li key={submission.id ?? submission._id}>
                <span className="submissions-panel__kind">
                  {KIND_LABELS[submission.type] ?? submission.type}
                </span>

                <span className="submissions-panel__name">
                  {submission.data?.firstName} {submission.data?.lastName}
                  {submission.submittedRegistrationNumber &&
                    ` — ${submission.submittedRegistrationNumber}`}
                </span>

                <button
                  type="button"
                  onClick={() => openDetail(submission)}
                >
                  Examiner
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <AdminModal title="Revue de la demande" onClose={closeDetail}>
          {!detail && !detailError && <AdminLoading label="Chargement…" />}

          {detailError && (
            <p className="submissions-panel__alert" role="alert">
              {detailError}
            </p>
          )}

          {detail && (
            <>
              <table className="submissions-panel__diff">
                <thead>
                  <tr>
                    <th>Champ</th>
                    {isUpdate && <th>Avant</th>}
                    <th>{isUpdate ? "Après" : "Valeur soumise"}</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.field}>
                      <td>{row.label}</td>
                      {isUpdate && <td>{row.before}</td>}
                      <td>{row.after}</td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isUpdate ? 3 : 2}>
                        Aucune différence avec la fiche actuelle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="submissions-panel__overrides">
                <p>Corriger si nécessaire avant de valider :</p>

                {EDITABLE_FIELDS.map((field) => (
                  <label key={field}>
                    {FIELD_LABELS[field]}
                    <input
                      type="text"
                      value={
                        overrides[field] ??
                        detail.submission.data[field] ??
                        ""
                      }
                      onChange={(event) =>
                        setOverrides((previous) => ({
                          ...previous,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              {actionError && (
                <p className="submissions-panel__alert" role="alert">
                  {actionError}
                </p>
              )}

              {rejecting ? (
                <div className="submissions-panel__reject">
                  <label htmlFor="submission-reject-reason">
                    Motif du rejet (interne)
                  </label>

                  <textarea
                    id="submission-reject-reason"
                    rows={3}
                    value={rejectReason}
                    onChange={(event) =>
                      setRejectReason(event.target.value)
                    }
                  />

                  <div className="submissions-panel__actions">
                    <button
                      type="button"
                      className="submissions-panel__ghost"
                      onClick={() => setRejecting(false)}
                      disabled={busy}
                    >
                      Annuler
                    </button>

                    <button
                      type="button"
                      className="submissions-panel__danger"
                      onClick={handleReject}
                      disabled={busy}
                    >
                      {busy ? "Envoi…" : "Confirmer le rejet"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="submissions-panel__actions">
                  <button
                    type="button"
                    className="submissions-panel__danger"
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                  >
                    <XCircle aria-hidden="true" />
                    Rejeter
                  </button>

                  <button
                    type="button"
                    className="submissions-panel__approve"
                    onClick={handleApprove}
                    disabled={busy}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    {busy ? "Validation…" : "Valider"}
                  </button>
                </div>
              )}
            </>
          )}
        </AdminModal>
      )}
    </section>
  );
};

export default SubmissionsPanel;
```

- [ ] **Step 2: Styliser le panneau**

```scss
@use "../../../styles/variables" as *;

.submissions-panel {
  &__header {
    margin-bottom: 24px;

    h1 {
      margin: 0 0 6px;
      color: $primary-dark;
    }

    p {
      margin: 0;
      color: #6b7280;
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;

    display: flex;
    flex-direction: column;
    gap: 10px;

    li {
      display: flex;
      align-items: center;
      gap: 16px;

      padding: 14px 18px;
      border: 1px solid #eef1ef;
      border-radius: 12px;

      button {
        margin-left: auto;
        padding: 8px 16px;
        border: none;
        border-radius: 10px;
        background: $primary;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
    }
  }

  &__kind {
    padding: 4px 10px;
    border-radius: 999px;
    background: #eef1ef;
    font-size: 0.8rem;
    font-weight: 700;
  }

  &__name {
    font-weight: 600;
  }

  &__diff {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;

    th,
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #eef1ef;
      text-align: left;
      font-size: 0.9rem;
    }

    th {
      color: #6b7280;
      font-weight: 700;
    }
  }

  &__overrides {
    margin-bottom: 20px;

    p {
      margin: 0 0 10px;
      font-weight: 700;
    }

    label {
      display: block;
      margin-bottom: 10px;
      font-size: 0.85rem;
      color: #4b5563;
    }

    input {
      width: 100%;
      min-height: 44px;
      margin-top: 4px;
      padding: 0 12px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
    }
  }

  &__reject {
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 700;
    }

    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      margin-bottom: 14px;
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  &__approve,
  &__danger,
  &__ghost {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    padding: 10px 20px;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  &__approve {
    background: $primary;
    color: #fff;
  }

  &__danger {
    background: #fdecea;
    color: #c0392b;
  }

  &__ghost {
    background: transparent;
    border: 1px solid #d1d5db !important;
    color: #4b5563;
  }

  &__alert {
    margin: 0 0 16px;
    padding: 10px 14px;
    border-left: 4px solid #c0392b;
    border-radius: 8px;
    background: rgba(192, 57, 43, 0.08);
    color: #c0392b;
  }
}
```

- [ ] **Step 3: Vérifier manuellement**

`npm run build` doit se terminer sans erreur. Une vérification fonctionnelle complète n'est possible qu'après Task 12 (montage dans `CommunityAdmin.jsx`) — reportée à cette tâche.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/SubmissionsPanel
git commit -m "feat(frontend): ajoute le panneau de moderation des inscriptions"
```

---

### Task 12: Intégration dans l'administration — onglets Bergeries, Inscriptions, enrichissement Membres

**Files:**
- Modify: `src/pages/admin/CommunityAdmin.jsx`
- Modify: `src/pages/admin/CommunityAdmin.scss`

**Interfaces:**
- Consumes: `flocks`, `memberSubmissions` (Task 7), `SubmissionsPanel` (Task 11), `CHURCHES`/`churchLabel`/`GENDERS`/`MARITAL_STATUSES` (Task 8), `formatRegistrationNumber` (Task 7), `apiBaseUrl`/`getToken` (`src/services/http.js`, existants).

- [ ] **Step 1: Ajouter les imports**

Dans `src/pages/admin/CommunityAdmin.jsx`, remplacer le bloc d'imports (lignes 1-9) par :

```jsx
import { useState } from "react";

import { Download } from "lucide-react";

import {
  announcements,
  members,
  flocks as flocksApi,
} from "../../services/api";
import { apiBaseUrl, getToken } from "../../services/http";

import usePageMeta from "../../hooks/usePageMeta";
import useAsyncData from "../../hooks/useAsyncData";

import AdminCrud from "../../components/admin/AdminCrud";
import SubmissionsPanel from "../../components/admin/SubmissionsPanel";

import { CHURCHES, churchLabel, GENDERS, MARITAL_STATUSES } from "../../components/registration/RegistrationForm/data";
import { formatRegistrationNumber } from "../../utils/registrationNumber";

import "./CommunityAdmin.scss";
```

- [ ] **Step 2: Ajouter les définitions des bergeries**

Après le bloc `const ROLE_LABELS = ...` (ligne 100-102 actuelles), ajouter :

```js
const FLOCK_STATUSES = [
  { value: "published", label: "Active" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivée" },
];

const FLOCK_STATUS_LABELS = Object.fromEntries(
  FLOCK_STATUSES.map((item) => [item.value, item.label])
);

const flockFields = [
  {
    name: "code",
    label: "Code (2 lettres)",
    required: true,
    placeholder: "OL",
  },
  { name: "name", label: "Nom de la bergerie", required: true },
  {
    name: "church",
    label: "Église",
    type: "select",
    required: true,
    options: CHURCHES.map((church) => ({
      value: String(church.value),
      label: church.label,
    })),
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: FLOCK_STATUSES,
  },
];

const flockColumns = [
  { key: "code", label: "Code" },
  { key: "name", label: "Nom" },
  {
    key: "church",
    label: "Église",
    render: (item) => churchLabel(item.church),
  },
  {
    key: "status",
    label: "Statut",
    render: (item) => FLOCK_STATUS_LABELS[item.status] ?? item.status,
  },
];

const flockToValues = (item) => ({
  code: item?.code ?? "",
  name: item?.name ?? "",
  church: item?.church ? String(item.church) : "",
  status: item?.status ?? "published",
});

const flockToPayload = (values) => ({
  code: values.code.trim().toUpperCase(),
  name: values.name.trim(),
  church: Number(values.church),
  status: values.status || "published",
});
```

- [ ] **Step 3: Enrichir les champs, colonnes et conversions du formulaire Membres**

Remplacer le bloc `memberFields` existant (lignes 45-98) — conserver les champs déjà présents et insérer les nouveaux juste avant `notes`, comme prévu dans la spec. Le composant a désormais besoin de la liste des bergeries pour construire dynamiquement les options du champ `flock` : cette construction se fait donc via une fonction, appelée depuis le composant (Step 5), et non plus comme une constante de portée module.

Remplacer :

```js
const memberFields = [
  {
    name: "firstName",
    label: "Prénom",
    required: true,
  },
  {
    name: "lastName",
    label: "Nom",
    required: true,
  },
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
  },
  {
    name: "phone",
    label: "Téléphone",
    type: "tel",
    placeholder: "+225 07 00 00 00 00",
  },
  {
    // Le modèle nomme ce champ `area`.
    name: "area",
    label: "Quartier / groupe de maison",
    placeholder: "Angré Château",
  },
  {
    name: "role",
    label: "Rôle",
    type: "select",
    options: MEMBER_ROLES,
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: MEMBER_STATUSES,
  },
  {
    name: "joinedAt",
    label: "Date d'arrivée",
    type: "date",
  },
  {
    name: "notes",
    label: "Notes internes",
    type: "textarea",
    wide: true,
    rows: 3,
    help: "Visible uniquement dans cette administration, jamais sur le site public.",
  },
];
```

par :

```js
const buildMemberFields = (flockOptions) => [
  {
    name: "firstName",
    label: "Prénom",
    required: true,
  },
  {
    name: "lastName",
    label: "Nom",
    required: true,
  },
  {
    name: "email",
    label: "Adresse e-mail",
    type: "email",
  },
  {
    name: "phone",
    label: "Téléphone",
    type: "tel",
    placeholder: "+225 07 00 00 00 00",
  },
  {
    // Le modèle nomme ce champ `area`.
    name: "area",
    label: "Quartier / groupe de maison",
    placeholder: "Angré Château",
  },
  {
    name: "role",
    label: "Rôle",
    type: "select",
    options: MEMBER_ROLES,
  },
  {
    name: "status",
    label: "Statut",
    type: "select",
    options: MEMBER_STATUSES,
  },
  {
    name: "joinedAt",
    label: "Date d'arrivée",
    type: "date",
  },
  {
    name: "registrationNumber",
    label: "Matricule",
    placeholder: "1OL16005E (facultatif)",
    help: "Laissez vide pour les membres inscrits depuis le site : le matricule est alors attribué automatiquement à la validation de leur inscription.",
  },
  {
    name: "church",
    label: "Église",
    type: "select",
    options: CHURCHES.map((church) => ({
      value: String(church.value),
      label: church.label,
    })),
  },
  {
    name: "flock",
    label: "Bergerie",
    type: "select",
    options: flockOptions,
  },
  { name: "whatsapp", label: "WhatsApp", type: "tel" },
  { name: "address", label: "Adresse", wide: true },
  { name: "dateOfBirth", label: "Date de naissance", type: "date" },
  {
    name: "gender",
    label: "Genre",
    type: "select",
    options: GENDERS,
  },
  {
    name: "maritalStatus",
    label: "Situation matrimoniale",
    type: "select",
    options: MARITAL_STATUSES,
  },
  { name: "childrenCount", label: "Nombre d'enfants", type: "number" },
  { name: "conversionYear", label: "Année de conversion", type: "number" },
  { name: "previousChurch", label: "Église précédente" },
  { name: "profession", label: "Profession" },
  { name: "skills", label: "Compétences (séparées par des virgules)" },
  { name: "desiredDepartment", label: "Département souhaité" },
  { name: "availability", label: "Disponibilités", wide: true },
  {
    name: "emergencyContactName",
    label: "Contact d'urgence — nom",
  },
  {
    name: "emergencyContactPhone",
    label: "Contact d'urgence — téléphone",
    type: "tel",
  },
  {
    name: "notes",
    label: "Notes internes",
    type: "textarea",
    wide: true,
    rows: 3,
    help: "Visible uniquement dans cette administration, jamais sur le site public.",
  },
];
```

Remplacer le bloc `memberColumns` existant par :

```js
const memberColumns = [
  {
    key: "registrationNumber",
    label: "Matricule",
    render: (item) =>
      item.registrationNumber
        ? formatRegistrationNumber(item.registrationNumber)
        : "—",
  },
  {
    key: "name",
    label: "Membre",
    render: (item) =>
      [item.firstName, item.lastName].filter(Boolean).join(" ") ||
      "—",
  },
  { key: "area", label: "Quartier / groupe" },
  {
    key: "role",
    label: "Rôle",
    render: (item) => (
      <span className="admin-crud__pill">
        {ROLE_LABELS[item.role] ?? "—"}
      </span>
    ),
  },
  { key: "phone", label: "Téléphone" },
  {
    key: "status",
    label: "Statut",
    render: (item) =>
      item.status === "inactif" ? (
        <span className="admin-crud__muted">Inactif</span>
      ) : (
        "Actif"
      ),
  },
];
```

Remplacer `memberToValues` par (ajout des nouveaux champs) :

```js
const memberToValues = (item) => ({
  firstName: item?.firstName ?? "",
  lastName: item?.lastName ?? "",
  email: item?.email ?? "",
  phone: item?.phone ?? "",
  area: item?.area ?? "",
  role: item?.role ?? "membre",
  status: item?.status ?? "actif",
  joinedAt: toDateInput(item?.joinedAt),
  registrationNumber: item?.registrationNumber ?? "",
  church: item?.church ? String(item.church) : "",
  flock: item?.flock?.id ?? item?.flock ?? "",
  whatsapp: item?.whatsapp ?? "",
  address: item?.address ?? "",
  dateOfBirth: toDateInput(item?.dateOfBirth),
  gender: item?.gender ?? "",
  maritalStatus: item?.maritalStatus ?? "",
  childrenCount: item?.childrenCount ?? "",
  conversionYear: item?.conversionYear ?? "",
  baptismWater: Boolean(item?.baptism?.water),
  baptismWaterYear: item?.baptism?.waterYear ?? "",
  baptismHolySpirit: Boolean(item?.baptism?.holySpirit),
  previousChurch: item?.previousChurch ?? "",
  profession: item?.profession ?? "",
  skills: Array.isArray(item?.skills) ? item.skills.join(", ") : "",
  desiredDepartment: item?.desiredDepartment ?? "",
  availability: item?.availability ?? "",
  emergencyContactName: item?.emergencyContact?.name ?? "",
  emergencyContactPhone: item?.emergencyContact?.phone ?? "",
  notes: item?.notes ?? "",
});

const memberToPayload = (values) => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  email: values.email.trim() || undefined,
  phone: values.phone.trim() || undefined,
  area: values.area.trim() || undefined,
  role: values.role || "membre",
  status: values.status || "actif",
  joinedAt: values.joinedAt || undefined,
  registrationNumber: values.registrationNumber.trim() || undefined,
  church: values.church ? Number(values.church) : undefined,
  flock: values.flock || undefined,
  whatsapp: values.whatsapp.trim() || undefined,
  address: values.address.trim() || undefined,
  dateOfBirth: values.dateOfBirth || undefined,
  gender: values.gender || undefined,
  maritalStatus: values.maritalStatus || undefined,
  childrenCount:
    values.childrenCount !== "" ? Number(values.childrenCount) : undefined,
  conversionYear:
    values.conversionYear !== "" ? Number(values.conversionYear) : undefined,
  baptism: {
    water: Boolean(values.baptismWater),
    waterYear:
      values.baptismWaterYear !== ""
        ? Number(values.baptismWaterYear)
        : undefined,
    holySpirit: Boolean(values.baptismHolySpirit),
  },
  previousChurch: values.previousChurch.trim() || undefined,
  profession: values.profession.trim() || undefined,
  skills: values.skills
    ? values.skills
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [],
  desiredDepartment: values.desiredDepartment.trim() || undefined,
  availability: values.availability.trim() || undefined,
  emergencyContact: {
    name: values.emergencyContactName.trim() || undefined,
    phone: values.emergencyContactPhone.trim() || undefined,
  },
  notes: values.notes,
});
```

- [ ] **Step 4: Ajouter le composant des boutons d'export**

Après les définitions ci-dessus, avant `const TABS = [...]` :

```jsx
const MemberExportButtons = ({ flockOptions }) => {
  const [filters, setFilters] = useState({ church: "", flock: "", status: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // L'export passe par `fetch` plutôt qu'un simple lien : la route est
  // protégée, et un `<a href>` n'emporte pas l'en-tête d'autorisation
  // (même mécanisme que l'export CSV de la lettre d'information).
  const download = async (kind) => {
    setBusy(kind);
    setError("");

    try {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== "")
        )
      );

      const response = await fetch(
        `${apiBaseUrl}/api/admin/members/export.${kind}?${query}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      if (!response.ok) {
        throw new Error(`L'export a échoué (code ${response.status}).`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        kind === "xlsx" ? "membres-cava.xlsx" : "registre-membres-cava.pdf";
      link.click();

      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught?.message ?? "L'export a échoué.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="admin-community__export">
      <select
        aria-label="Filtrer par église"
        value={filters.church}
        onChange={(event) =>
          setFilters((previous) => ({ ...previous, church: event.target.value }))
        }
      >
        <option value="">Toutes les églises</option>
        {CHURCHES.map((church) => (
          <option key={church.value} value={church.value}>
            {church.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrer par bergerie"
        value={filters.flock}
        onChange={(event) =>
          setFilters((previous) => ({ ...previous, flock: event.target.value }))
        }
      >
        <option value="">Toutes les bergeries</option>
        {flockOptions.map((flock) => (
          <option key={flock.value} value={flock.value}>
            {flock.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrer par statut"
        value={filters.status}
        onChange={(event) =>
          setFilters((previous) => ({ ...previous, status: event.target.value }))
        }
      >
        <option value="">Tous les statuts</option>
        <option value="actif">Actif</option>
        <option value="inactif">Inactif</option>
      </select>

      <button type="button" onClick={() => download("xlsx")} disabled={busy !== ""}>
        <Download aria-hidden="true" />
        {busy === "xlsx" ? "Export…" : "Excel"}
      </button>

      <button type="button" onClick={() => download("pdf")} disabled={busy !== ""}>
        <Download aria-hidden="true" />
        {busy === "pdf" ? "Export…" : "PDF"}
      </button>

      {error && (
        <p className="admin-community__alert" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Étendre les onglets et le corps du composant `CommunityAdmin`**

Remplacer `const TABS = [...]` par :

```js
const TABS = [
  { id: "announcements", label: "Annonces" },
  { id: "members", label: "Membres" },
  { id: "flocks", label: "Bergeries" },
  { id: "submissions", label: "Inscriptions" },
];
```

Dans le composant `CommunityAdmin`, juste après `const [tab, setTab] = useState("announcements");`, charger la liste des bergeries une fois pour construire les options des deux sélecteurs qui en dépendent :

```jsx
  const { data: flockList } = useAsyncData(flocksApi.listAdmin);

  const flockOptions = (flockList ?? []).map((flock) => ({
    value: flock.id,
    label: `${flock.name} (${churchLabel(flock.church)})`,
  }));

  const memberFields = buildMemberFields(flockOptions);
```

Ajouter deux nouveaux panneaux d'onglet, après le panneau `members` existant (juste avant la fermeture de la balise racine `</div>` du composant) :

```jsx
      <div
        role="tabpanel"
        id="admin-community-panel-flocks"
        aria-labelledby="admin-community-tab-flocks"
        hidden={tab !== "flocks"}
      >
        {tab === "flocks" && (
          <AdminCrud
            resource={flocksApi}
            fields={flockFields}
            columns={flockColumns}
            labels={{
              singular: "une bergerie",
              plural: "Bergeries",
              add: "Ajouter une bergerie",
              empty:
                "Aucune bergerie enregistrée. Elles alimentent la liste déroulante du formulaire d'inscription et de la fiche membre.",
              loadingSuffix: "des bergeries",
              description:
                "Chaque membre appartient à une bergerie, rattachée à une église.",
              titleKey: "name",
            }}
            toValues={flockToValues}
            toPayload={flockToPayload}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="admin-community-panel-submissions"
        aria-labelledby="admin-community-tab-submissions"
        hidden={tab !== "submissions"}
      >
        {tab === "submissions" && <SubmissionsPanel />}
      </div>

```

Enfin, dans le panneau `members` existant, insérer `<MemberExportButtons flockOptions={flockOptions} />` juste avant `<AdminCrud` (à l'intérieur du même bloc conditionnel `{tab === "members" && (...)}`), et passer les nouvelles props `toPayload={memberToPayload}` à ce même `<AdminCrud>` :

```jsx
        {tab === "members" && (
          <>
            <MemberExportButtons flockOptions={flockOptions} />

            <AdminCrud
              resource={members}
              fields={memberFields}
              columns={memberColumns}
              labels={{
                singular: "un membre",
                plural: "Membres",
                add: "Ajouter un membre",
                empty:
                  "Aucun membre enregistré. Cette liste sert au suivi interne et n'est pas publiée sur le site.",
                loadingSuffix: "des membres",
                description:
                  "Annuaire interne des membres. Ces informations ne sont jamais affichées sur le site public.",
                titleKey: "lastName",
              }}
              toValues={memberToValues}
              toPayload={memberToPayload}
            />
          </>
        )}
```

- [ ] **Step 6: Styliser la barre d'export**

Dans `src/pages/admin/CommunityAdmin.scss`, ajouter (toujours imbriqué sous une classe de ce fichier, jamais à la racine) :

```scss
.admin-community__export {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;

  margin-bottom: 18px;

  select {
    height: 40px;
    padding: 0 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: 8px;

    background: #0d5b3e;
    color: #fff;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: progress;
    }
  }
}

.admin-community__alert {
  margin: 10px 0 0;
  padding: 10px 14px;
  border-left: 4px solid #c0392b;
  border-radius: 8px;
  background: rgba(192, 57, 43, 0.08);
  color: #c0392b;
}
```

- [ ] **Step 7: Vérifier manuellement**

```bash
npm run build
npm run lint
```

Puis en navigateur (`npm run dev`, backend démarré, connecté en tant qu'administrateur sur `/admin/communaute`) :
1. Onglet **Bergeries** : créer une bergerie (ex. code `OL`, nom « El Olam », église 1). Elle doit apparaître dans la liste.
2. Onglet **Membres** : ouvrir « Ajouter un membre », vérifier que les nouveaux champs (matricule, église, bergerie, état civil, vie spirituelle, engagement, contact d'urgence) s'affichent et s'enregistrent ; la colonne « Matricule » de la liste doit afficher le format avec espaces (`1OL 16-005 E`) pour un membre qui en a un.
3. Cliquer « Excel » puis « PDF » dans la barre d'export : les deux fichiers doivent se télécharger sans erreur.
4. Retourner sur `/inscription` (onglet précédent), soumettre une inscription complète — la bergerie créée à l'étape 1 doit maintenant apparaître dans son menu déroulant.
5. Revenir dans l'admin, onglet **Inscriptions** : la demande doit apparaître. Cliquer « Examiner » : la fenêtre de revue doit s'ouvrir, afficher les champs soumis, permettre de corriger le prénom/nom/téléphone/e-mail, puis « Valider ».
6. Après validation, vérifier dans l'onglet **Membres** que le nouveau membre apparaît avec un matricule au format `1OL 26-001 A` (numéro et lettre dépendent du compteur réel de l'église 1 à ce stade).
7. Répéter une soumission et cette fois cliquer « Rejeter » avec un motif : la demande doit disparaître de la file sans créer de membre.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/CommunityAdmin.jsx src/pages/admin/CommunityAdmin.scss
git commit -m "feat(frontend): integre bergeries, inscriptions et matricule dans l'administration"
```

---

## Notes de portée (décisions prises pendant l'écriture du plan)

- **Photo de profil retirée du formulaire public.** La spec l'incluait dans le formulaire d'inscription, mais l'envoi de fichiers (`FileField`) repose sur `POST /api/admin/uploads/signature`, une route **authentifiée**. Ouvrir l'envoi de fichiers à un visiteur anonyme est une extension de surface d'attaque distincte, qui n'a pas été explicitement validée. La photo reste modifiable par un administrateur depuis l'onglet Membres (champ déjà existant sur le modèle, simplement non exposé au public ici).
- **Import du registre papier existant (44 matricules) hors périmètre**, comme déjà noté dans la spec — ce plan construit l'outil, pas la migration des données historiques.
- **« Modifier puis valider »** est implémenté sur un sous-ensemble ciblé de champs (prénom, nom, téléphone, e-mail) plutôt qu'un éditeur générique de tous les champs, pour rester proportionné à l'usage décrit (« corriger une coquille de téléphone »).
