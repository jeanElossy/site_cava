# Déploiement de l'API sur Render

## Avant de commencer

Vous aurez besoin de :

- votre chaîne de connexion MongoDB Atlas
- l'URL de votre site sur Vercel

---

## 1. Autoriser Render dans MongoDB Atlas

**À lire avant d'agir — c'est un compromis de sécurité réel.**

Le plan gratuit de Render ne fournit **pas d'adresse IP fixe**. Votre
API peut donc sortir depuis n'importe quelle adresse de leur
infrastructure, qui change sans préavis.

Conséquence : dans Atlas → **Network Access**, vous devrez autoriser
`0.0.0.0/0`, c'est-à-dire **toutes les adresses IP du monde**.

Ce que cela signifie concrètement : votre base n'est plus protégée que
par son mot de passe. N'importe qui connaissant la chaîne de connexion
peut s'y connecter, depuis n'importe où.

Ce qui rend la situation acceptable :

- le mot de passe a été renouvelé et n'est plus celui partagé en clair
- il ne figure ni dans le dépôt, ni dans le site public
- l'utilisateur Atlas ne devrait avoir accès qu'à la base `cava-eglise`

Ce qu'il faut faire dès que le projet sort du test :

- passer au plan payant de Render (25 $/mois), qui fournit des IP
  fixes à autoriser précisément,
- ou héberger l'API sur un VPS à IP fixe.

---

## 2. Créer le service sur Render

1. Sur [render.com](https://render.com) → **New** → **Web Service**
2. Connecter le dépôt GitHub `site_cava`
3. Renseigner :

| Champ | Valeur |
|---|---|
| Name | `cava-api` |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

Le fichier `render.yaml` reprend cette configuration si vous préférez
passer par un Blueprint.

---

## 3. Variables d'environnement

Dans **Environment**, ajouter :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `MONGODB_URI` | votre chaîne Atlas |
| `JWT_SECRET` | cliquer sur **Generate** |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | l'URL de votre site Vercel |
| `SEED_ADMIN_EMAIL` | votre e-mail |
| `SEED_ADMIN_PASSWORD` | un mot de passe de 12 caractères minimum |

**Ne pas définir `PORT`** : Render l'injecte lui-même.

`TRUST_PROXY=1` n'est pas optionnel. Sans lui, la limitation de débit
compte toutes les requêtes sur l'adresse du proxy Render et bloque
tous vos visiteurs d'un coup.

---

## 4. Amorcer la base (une seule fois)

Après le premier déploiement réussi, ouvrir l'onglet **Shell** du
service et lancer :

```bash
npm run seed
```

Le script est idempotent : il ne crée que ce qui manque et n'écrase
jamais un contenu existant. Il peut être relancé sans risque.

Une fois l'administrateur créé, les variables `SEED_ADMIN_*` peuvent
être supprimées.

---

## 5. Vérifier

```
https://cava-api.onrender.com/api/health
```

Doit renvoyer `{"success":true,...,"status":"ok"}`.

Puis vérifier que le contenu remonte :

```
https://cava-api.onrender.com/api/events
```

---

## 6. Brancher le site

Dans Vercel → Settings → Environment Variables :

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | `https://cava-api.onrender.com` |

Puis redéployer le site pour que le build aille chercher le contenu
dans la base.

---

## Ce qu'il faut savoir sur le plan gratuit

**Le service s'endort après 15 minutes sans requête.** Le réveil prend
environ 50 secondes.

Cela ne gêne **pas vos visiteurs** : le site public est statique et
n'appelle jamais l'API. Seuls sont concernés :

- l'ouverture de l'espace d'administration
- l'envoi du formulaire de contact
- la reconstruction du site au moment d'une publication

**750 heures gratuites par mois**, largement suffisant pour un seul
service.

---

## Activer l'espace d'administration

Il est **exclu des builds publics** par défaut. Pour y accéder en
ligne, il faut le compiler explicitement :

```
VITE_ENABLE_ADMIN=true
```

**Ne l'activez pas sur le déploiement public.** L'API refuse toute
requête non authentifiée, donc aucune donnée ne fuiterait, mais
l'écran de connexion et le code de l'administration deviendraient
accessibles à quiconque devine l'adresse.

L'usage recommandé : une préversion Vercel protégée par mot de passe,
ou une utilisation en local uniquement.
