// Client HTTP unique de l'application.
//
// Toutes les requêtes vers l'API passent ici : une seule place pour
// l'URL de base, le jeton d'authentification, le format d'erreur et
// la normalisation des identifiants.

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

const TOKEN_KEY = "cava:token";

// STOCKAGE DU JETON — compromis assumé.
//
// Le `localStorage` est lisible par tout script exécuté sur la page :
// une faille XSS permettrait de voler le jeton. L'alternative (cookie
// httpOnly) est immunisée contre ça, mais impose de gérer le CSRF et
// un domaine partagé entre le site et l'API.
//
// Choix retenu ici car la CSP du site est stricte (`script-src 'self'`,
// aucun script tiers), ce qui réduit fortement la surface XSS. À
// reconsidérer si des scripts externes sont un jour autorisés.
export const getToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible */
  }
};

// Erreur portant le code HTTP et le détail par champ renvoyé par
// l'API, pour que les formulaires affichent le bon message au bon
// endroit.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);

    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

// MongoDB expose `_id` ; les composants du front attendent `id`.
// La conversion est faite ici plutôt que dans chaque écran.
const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);

  if (value && typeof value === "object") {
    const out = { ...value };

    if (out._id && !out.id) out.id = String(out._id);

    return out;
  }

  return value;
};

export const request = async (
  path,
  { method = "GET", body, auth = false, signal } = {}
) => {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();

    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // Panne réseau ou API injoignable : distinguer ce cas d'une
    // erreur applicative évite d'afficher « données invalides »
    // quand le serveur est simplement éteint.
    if (error.name === "AbortError") throw error;

    throw new HttpError(
      0,
      "Serveur injoignable. Vérifiez votre connexion."
    );
  }

  if (response.status === 204) return null;

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    /* réponse sans corps */
  }

  if (!response.ok) {
    // Jeton expiré ou révoqué : on nettoie pour éviter de boucler
    // sur des requêtes vouées à échouer.
    if (response.status === 401) setToken(null);

    throw new HttpError(
      response.status,
      payload?.message ?? "Une erreur est survenue.",
      payload?.error?.details
    );
  }

  return normalize(payload?.data ?? null);
};

// Variante conservant les métadonnées de pagination.
export const requestWithMeta = async (path, options) => {
  const headers = {};

  if (options?.auth) {
    const token = getToken();

    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(BASE_URL + path, {
    method: "GET",
    headers,
    signal: options?.signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) setToken(null);

    throw new HttpError(
      response.status,
      payload?.message ?? "Une erreur est survenue.",
      payload?.error?.details
    );
  }

  return {
    items: normalize(payload?.data ?? []),
    meta: payload?.meta ?? null,
  };
};

export const apiBaseUrl = BASE_URL;
