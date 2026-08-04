# Système de badgeage des présences — Design

Date : 2026-08-04
Statut : validé par l'utilisateur, en attente de plan d'implémentation.

## Contexte

Le CAVA veut mesurer la présence réelle aux cultes et rassemblements. L'utilisateur a fourni une spécification fonctionnelle et sécurité détaillée (rédigée par lui-même, deux itérations) accompagnée de deux maquettes : un écran de connexion agent en deux temps (QR de sécurité puis matricule), et un tableau de bord de scan avec confirmation visuelle. Le principe retenu :

- Un **agent de badgeage** (un membre existant, pas un compte séparé) s'authentifie sur une page dédiée en scannant un **QR de sécurité** propre à un service, puis en saisissant son propre matricule.
- Une fois authentifié, il scanne en continu les **cartes de membre** (déjà émises — voir [2026-07-29-inscription-membres-design.md](2026-07-29-inscription-membres-design.md) et la carte PDF/JPEG) pour enregistrer leur présence.
- Le QR de sécurité est généré et révocable depuis l'administration, borné à une fenêtre horaire par événement, et son usage est journalisé.

Réutilise l'infrastructure existante : `Member` (avec son `registrationNumber`), le JWT déjà signé avec `JWT_SECRET` pour les sessions admin ([backend/src/middlewares/auth.js](../../../backend/src/middlewares/auth.js)), la génération de QR serveur via `qrcode` (déjà utilisée pour les dons et l'authentificateur 2FA), et `createCrudService` pour les écrans de liste admin.

## Modèles de données (nouveaux)

### `PresenceSecurityQr`

Un QR de sécurité, imprimé et affiché dans la salle du Service d'Ordre avant un culte/service.

```
{
  label: String,               // "Culte du dimanche 8h30"
  event: ObjectId | null,      // référence Event, facultative — simple lien de confort
  validFrom: Date,
  validUntil: Date,
  jti: String (unique),        // identifiant aléatoire (crypto.randomBytes), embarqué dans le JWT
  status: "active" | "revoked",
  revokedAt: Date | null,
  revokedBy: ObjectId (ref User) | null,
  createdBy: ObjectId (ref User),
}
```

Le QR imprimé encode `${PUBLIC_SITE_URL}/presences?qr=<jwt>`. Le JWT (signé `JWT_SECRET`, `scope: "presence_qr"`) ne contient que `{ jti }` — la fenêtre de validité et le statut restent en base et sont revérifiés à **chaque** usage (voir Sécurité). C'est ce qui rend une révocation immédiate, y compris pendant qu'un agent est déjà en session.

### `PresenceLogin`

Historique de connexion d'un agent, alimente l'écran admin « historique d'usage » :

```
{
  securityQr: ObjectId (ref PresenceSecurityQr),
  agent: ObjectId (ref Member),
  loggedInAt: Date,
  ip: String,
  userAgent: String,
}
```

### `Attendance`

Une présence enregistrée :

```
{
  member: ObjectId (ref Member),
  securityQr: ObjectId (ref PresenceSecurityQr),   // porte le libellé et la fenêtre du service
  agent: ObjectId (ref Member),                     // qui a badgé
  method: "scan" | "manual",                        // manual = "carte oubliée"
  recordedAt: Date,
  ip: String,
  userAgent: String,
}
```

Index unique composé `{ member: 1, securityQr: 1 }` : un même membre ne peut avoir qu'une seule présence par service, quel que soit le nombre de scans. Un scan répété renvoie la présence déjà enregistrée (`alreadyRecorded: true`, avec l'heure du premier enregistrement) plutôt qu'une erreur ou un doublon.

## Sécurité du QR et de la session agent

1. **Signature** : le JWT `presence_qr` est signé côté serveur ; sans `JWT_SECRET`, impossible d'en forger un valide.
2. **Autorité en base** : chaque vérification (`qr/verify`, `agent-login`, et à chaque requête authentifiée via `requirePresenceSession`) recharge le `PresenceSecurityQr` par son `jti` et vérifie `status === "active"` et `validFrom <= now <= validUntil`. Le JWT prouve l'authenticité du lien, jamais sa validité dans le temps — qui reste décidée par la base, modifiable à tout moment (révocation).
3. **Session agent courte** : après authentification par matricule, un second JWT (`scope: "presence_session"`) est émis, contenant `{ agentId, qrJti }`, avec une expiration = min(6h, `validUntil` du QR). Toute route de scan/marquage exige ce jeton (middleware `requirePresenceSession`, symétrique de `requireAuth`), qui revérifie à chaque appel que l'agent est toujours actif, que son rôle est toujours autorisé, et que le QR d'origine est toujours actif et dans sa fenêtre.
4. **Rôles autorisés** : seuls les membres avec `role` ∈ `{serviteur, responsable, pasteur, chantre, dirigeant}` peuvent devenir agent. Un `role: "membre"` connaissant son propre matricule ne peut pas ouvrir le scanner.
5. **Pas de confiance côté client** : la page `/presences` ne décide jamais elle-même qu'un QR ou une session est valide — chaque transition d'écran est déclenchée par la réponse d'un appel serveur.
6. **Stockage du jeton de session** : `sessionStorage` côté navigateur, jamais `localStorage` — l'appareil utilisé est généralement partagé (téléphone/tablette du Service d'Ordre), et la session doit s'effacer à la fermeture de l'onglet.

## API (backend)

### Publiques (aucune authentification préalable — c'est le mécanisme d'authentification lui-même)

- `POST /api/presences/qr/verify { token }` → `{ label, validFrom, validUntil }` ou 401 avec motif (expiré / pas encore valide / révoqué / invalide).
- `POST /api/presences/agent-login { token, matricule }` → vérifie à nouveau le QR, cherche le `Member` par `registrationNumber`, vérifie statut actif + rôle autorisé, émet la session, journalise un `PresenceLogin`. Retourne `{ sessionToken, agent: {firstName, lastName, photo, role}, qr: {label, validUntil} }`.

Toutes deux passent par un rate-limiter dédié (même pattern que `submissionLimiter`/`publicUploadLimiter`) — une saisie de matricule en boucle ne doit pas devenir un outil d'énumération des membres.

### Protégées par `requirePresenceSession`

- `POST /api/presences/scan { registrationNumber }` → trouve le membre, enregistre la présence (idempotent), retourne `{ member: {firstName, lastName, photo, registrationNumber}, alreadyRecorded, recordedAt }`.
- `GET /api/presences/search?q=` → recherche par nom, prénom, matricule **et téléphone** (fonction dédiée — la recherche admin générique ne couvre pas le téléphone), résultats limités et minimaux (pas de notes internes, pas de champs pastoraux).
- `POST /api/presences/mark { memberId }` → même enregistrement idempotent, `method: "manual"`, pour le secours « carte oubliée ».

### Admin (`requireAuth` + `requireRole("admin")`, sous `/api/admin/presences`)

- `GET /qrcodes` — liste des `PresenceSecurityQr` avec statut calculé (à venir / actif / expiré / révoqué).
- `POST /qrcodes { label, event?, validFrom, validUntil }` — crée le QR.
- `GET /qrcodes/:id/image` — rendu serveur (`QRCode.toDataURL`), même pattern que le QR de don.
- `POST /qrcodes/:id/revoke` — bascule `status: "revoked"`.
- `GET /qrcodes/:id/history` — liste des `PresenceLogin` pour ce QR.
- `GET /attendance?securityQr=&event=&from=&to=` — liste des présences enregistrées, pour tableau de bord/export.

## Parcours agent (`/presences`, page publique gardée par `VITE_ENABLE_ADMIN`, même interrupteur que `/admin`)

1. Scan du QR de sécurité (caméra du téléphone, hors app) → ouvre `/presences?qr=<jwt>`.
2. Le front appelle `qr/verify`. Si refusé : écran d'erreur explicite (« Ce QR a expiré », « Ce QR a été révoqué »…), pas d'accès au reste de la page.
3. Si valide : écran de saisie du matricule → `agent-login`.
4. Écran « Bienvenue [Prénom Nom], accès autorisé » puis bascule automatique, sans rechargement, sur le module de scan continu (caméra ouverte, lecture <1s visée, confirmation visuelle + sonore, retour auto en mode scan).
5. Bouton « Carte oubliée » à tout moment → recherche → sélection → marquage.

## Interface admin (`/admin/presences`)

Nouvel onglet, même famille visuelle que les écrans existants (`AdminCrud`) :

- Formulaire de génération de QR (libellé, événement optionnel — pré-remplit libellé/horaires depuis `Event` si choisi —, plage horaire) → affichage du QR généré, prêt à imprimer.
- Liste des QR avec statut, action « Révoquer », lien vers l'historique d'usage (agent, horodatage).
- Vue des présences enregistrées, filtrable par service/date, pour un contrôle a posteriori.

## Hors périmètre

- Export/statistiques avancées de présence (taux de fréquentation, tendances) — se limite à la liste brute filtrable ; une vraie couche analytique est un chantier séparé.
- Détection de position/appareil au-delà de l'IP et du user-agent déjà journalisés.
- Authentification biométrique ou tout facteur autre que matricule + QR de sécurité.
- Notification automatique (SMS/e-mail) en cas d'absence prolongée d'un membre.
- Le décodage caméra du QR de la carte membre utilise une lecture 100% navigateur (aucune nouvelle dépendance serveur) — le choix précis de la librairie front est un détail d'implémentation, pas un point de design.
