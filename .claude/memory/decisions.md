# Décisions Techniques

## Objectif

Ce document enregistre les décisions importantes prises au cours du développement.

Avant de proposer une modification importante, Claude doit consulter ce document afin d'éviter de remettre en question des choix déjà validés.

---

# Principe

Une décision validée est considérée comme une règle du projet.

Si une meilleure solution est proposée, Claude doit :

- expliquer pourquoi
- présenter les avantages
- présenter les inconvénients
- demander une validation

Ne jamais modifier une décision importante sans confirmation.

---

# Stack

Frontend Web

- React
- JavaScript (JSX)
- Vite

Frontend Mobile

- React Native
- Expo
- JavaScript (JSX)

Backend

- Node.js
- Express

Base de données

- MongoDB
- Mongoose

---

# Architecture

Le projet suit une architecture modulaire.

Frontend

Pages

↓

Components

↓

Services

↓

API

Backend

Routes

↓

Controllers

↓

Services

↓

Models

↓

MongoDB

---

# Conventions

Toujours :

- utiliser JavaScript
- utiliser JSX
- créer des composants réutilisables
- respecter les dossiers existants
- éviter la duplication

---

# Dépendances

Avant d'ajouter une nouvelle dépendance :

- vérifier si une solution existe déjà dans le projet
- expliquer pourquoi elle est nécessaire
- demander une validation

---

# Interface utilisateur

Toujours respecter :

- l'identité graphique du projet
- les composants existants
- les couleurs officielles
- les espacements
- les bonnes pratiques UX

---

# Sécurité

Toujours :

- valider les données
- protéger les routes privées
- utiliser les variables d'environnement
- protéger les secrets

---

# Performance

Toujours rechercher :

- composants inutiles
- imports inutiles
- appels API inutiles
- re-render inutiles
- calculs coûteux

---

# Évolutions futures

Avant de proposer une évolution importante :

- vérifier qu'elle respecte l'architecture actuelle
- vérifier qu'elle reste compatible avec les fonctionnalités existantes
- expliquer les impacts

---

# Historique des décisions

Ajouter ici les décisions importantes au fur et à mesure du projet.

Exemple :

## 2026-07-15

Décision :

Utilisation de React Router pour la navigation.

Raison :

Architecture plus adaptée au projet.

Impact :

Toutes les nouvelles pages devront utiliser React Router.

---

## Notes

Ce document est vivant.

Chaque décision importante doit être ajoutée afin que toute l'équipe conserve le même contexte.