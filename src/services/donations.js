import { request, requestWithMeta } from "./http";

// Accès à la chaîne de dons.
//
// ------------------------------------------------------------------
// CE QUE LE NAVIGATEUR NE PEUT PAS FAIRE
// ------------------------------------------------------------------
// Aucune fonction ici ne marque un don comme payé. Le front déclare une
// intention et lit un état ; c'est le serveur qui, par un appel sortant
// vers le prestataire, décide qu'une somme a été versée. Un utilisateur
// qui modifierait ce fichier dans son navigateur ne pourrait donc
// fabriquer qu'un don « en attente » sans valeur.
//
// Aucune coordonnée bancaire ne passe par ici non plus : la saisie a
// lieu sur le guichet hébergé du prestataire, après redirection.

// Les dons en ligne sont-ils activés côté serveur ?
//
// Interrogé avant d'afficher le bouton de paiement : tant que le compte
// marchand n'est pas ouvert, mieux vaut l'annoncer que laisser le
// donateur remplir trois étapes pour se heurter à un refus.
export const paymentConfig = () => request("/api/donations/config");

// Crée l'intention de don et renvoie l'URL du guichet de paiement.
export const startDonation = (payload) =>
  request("/api/donations", { method: "POST", body: payload });

// État d'un don, par sa référence publique.
//
// Le serveur en profite pour réinterroger le prestataire si le don est
// encore en attente : le donateur revient souvent avant la notification
// serveur à serveur, et parfois celle-ci n'arrive jamais.
export const donationStatus = (reference) =>
  request(`/api/donations/${encodeURIComponent(reference)}`);

// ---- Reçu ----------------------------------------------------------
//
// Le PDF est récupéré en binaire plutôt que lié directement.
//
// L'API et le site sont sur deux domaines distincts (Render et Vercel),
// et l'attribut `download` d'un lien est IGNORÉ pour une URL d'une
// autre origine : le navigateur ouvrirait le fichier au lieu de
// l'enregistrer. Passer par un objet local rend le téléchargement
// réellement possible — et permet en prime de partager le fichier
// lui-même, pas seulement un lien.
export const fetchReceipt = async (reference) => {
  const base = (
    import.meta.env.VITE_API_URL ?? "http://localhost:4000"
  ).replace(/\/+$/, "");

  const response = await fetch(
    `${base}/api/donations/${encodeURIComponent(reference)}/recu`
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new Error(
      payload?.message ?? "Le reçu n'a pas pu être généré."
    );
  }

  return {
    blob: await response.blob(),
    filename: `recu-cava-${reference}.pdf`,
  };
};

// ---- Administration ----------------------------------------------

export const adminDonations = (params = {}) =>
  requestWithMeta(
    `/api/admin/donations?${new URLSearchParams(params)}`,
    { auth: true }
  );

export const adminDonationSummary = () =>
  request("/api/admin/donations/summary", { auth: true });

export const adminDonationQrCode = (params = {}) =>
  request(
    `/api/admin/donations/qrcode?${new URLSearchParams(params)}`,
    { auth: true }
  );
