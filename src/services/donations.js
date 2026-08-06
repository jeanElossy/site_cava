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
