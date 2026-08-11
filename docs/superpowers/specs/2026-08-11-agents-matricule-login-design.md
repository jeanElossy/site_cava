# Connexion des agents de terrain par matricule (soa/cana/social)

Date : 2026-08-11
Statut : approuvé par l'utilisateur, prêt pour implémentation.

## Contexte

La section « Agents » du dashboard (`/admin/agents`, réservée `admin`) gère
aujourd'hui les comptes SOA/CANA/coordonnateur des bergeries/pasteur, avec
une connexion par e-mail + mot de passe. L'utilisateur veut :

1. Pouvoir créer depuis cette même section des comptes des nouveaux rôles
   `social_admin`/`social_agent`/`social_approver`/`social_viewer` (Service
   Social), au même titre que soa/cana.
2. Remplacer l'e-mail par le **matricule** (déjà connu de tout membre de
   l'église) pour la connexion de **tous** les agents de terrain — ces
   comptes n'ont souvent pas d'adresse e-mail facilement accessible. `admin`
   et `editor` gardent la connexion par e-mail (comptes de gestion classique,
   hors périmètre de ce changement).
3. Le matricule saisi à la création doit correspondre à un **membre déjà
   enregistré** (pas un identifiant libre).

## Modèle de données (`backend/src/models/User.js`)

- Nouveau champ `registrationNumber` : `String`, `trim`, `uppercase`,
  `sparse`, `unique`, même contrainte de forme que `Member.registrationNumber`
  (`/^[1-5][A-Z]{2}\d{2}\d{3}[A-Z]$/`).
- `email` : retire `required: true` (garde `unique`, ajoute `sparse: true`
  pour que plusieurs comptes sans e-mail ne collisionnent pas sur `null`).
- Validation conditionnelle (hook `pre('validate')`) :
  - `role` dans `["admin", "editor"]` → `email` obligatoire.
  - tout autre rôle (agents de terrain, y compris social_*) → `registrationNumber`
    obligatoire.

## Connexion (`backend/src/services/auth.service.js#login`)

Signature changée : `login({ identifier, password })` au lieu de
`{ email, password }`. Détection du type d'identifiant :

- si `identifier` normalisé (voir `normalizeRegistrationNumber` déjà
  existant dans `registrationNumber.service.js`) correspond à la forme d'un
  matricule → recherche `User.findOne({ registrationNumber: normalisé })`.
- sinon → recherche `User.findOne({ email: identifier.toLowerCase().trim() })`
  (comportement actuel, inchangé pour admin/editor).

Le message d'erreur unique (`"Identifiants incorrects."`), le verrouillage de
compte après 5 échecs et le rate limiting restent **strictement inchangés** —
aucune des deux voies de recherche ne doit révéler si un identifiant existe.

## Gestion des agents (`backend/src/services/agent.service.js`)

- `AGENT_ROLES` (interne à ce service, distinct du `AGENT_ROLES` frontend de
  `roleGroups.js` qui ne sert qu'au filtrage de la navigation Nouvelles
  Âmes) s'élargit à `["soa", "cana", "coordinateur_bergeries", "pasteur",
  "social_admin", "social_agent", "social_approver", "social_viewer"]`.
- `create`/`update` reçoivent `registrationNumber` au lieu de `email`.
  Avant création, vérifie qu'un `Member` existe avec ce matricule
  (normalisé) — sinon `ApiError.unprocessable("Aucun membre trouvé avec ce
  matricule.")`. Le nom reste saisi manuellement par l'admin (pas de
  préremplissage automatique en Phase 1 de ce changement — over-engineering
  pour un premier jet).
- Messages d'erreur de doublon adaptés ("Un compte existe déjà avec ce
  matricule.").
- Recherche (`list`) : `name`/`registrationNumber` au lieu de `name`/`email`.

## Frontend

- `src/services/auth.js#signIn({identifier, password})` — renommage direct,
  aucun autre appelant que `Login.jsx`.
- `src/pages/admin/Login.jsx` : le champ devient « E-mail ou matricule »
  (`type="text"`, pas `type="email"`), reste un champ unique — fonctionne
  pour tous les rôles sans que l'utilisateur ait à préciser lequel.
- `src/pages/admin/AgentsAdmin.jsx` : remplace le champ e-mail (création,
  édition, colonne du tableau, recherche) par un champ matricule. Ajoute les
  4 rôles sociaux à `ROLE_LABELS`/`ROLE_OPTIONS` (regroupés visuellement,
  ex. deux `<optgroup>` « Nouvelles Âmes » / « Service Social » dans le
  `<select>`). Met à jour le texte d'en-tête de page.

## Hors périmètre (assumé, pour rester focalisé)

- Pas de préremplissage automatique du nom depuis la fiche membre à la
  saisie du matricule (nécessiterait un nouvel endpoint de recherche
  dédié) — l'admin saisit le nom comme aujourd'hui, seule la validation
  d'existence est automatique.
- Pas de migration des comptes soa/cana existants qui auraient déjà un
  e-mail mais pas de matricule : ce changement s'applique aux nouveaux
  comptes créés après ce déploiement. Un compte existant sans matricule
  reste utilisable par e-mail tant qu'il n'est pas modifié (le hook de
  validation ne s'applique qu'à la création/modification, pas aux documents
  déjà en base).

## Vérification de sécurité

Ce changement touche le mécanisme de connexion — une revue de sécurité
dédiée est prévue juste après l'implémentation, avant de considérer le
travail terminé (propriétés à revérifier : absence d'énumération de compte,
verrouillage après échecs, aucune fuite d'information entre les deux voies
de recherche).
