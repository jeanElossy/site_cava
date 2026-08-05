// Fenêtre de validité EFFECTIVE d'un QR de sécurité de badgeage —
// calculée, jamais stockée : `activatedAt + durationMinutes`. `null`/
// `null` tant qu'aucun agent ne l'a encore scanné pour la première
// fois (voir models/PresenceSecurityQr.js et
// services/presenceQr.service.js#verifyToken, qui pose `activatedAt`).
//
// Utilitaire à part, plutôt que défini dans presenceQr.service.js et
// importé de là : middlewares/presenceAuth.js en a aussi besoin
// (signPresenceSessionToken, requirePresenceSession), mais
// presenceQr.service.js importe déjà DEPUIS presenceAuth.js (pour
// signer/vérifier le jeton QR) — l'importer dans l'autre sens créerait
// une dépendance circulaire entre les deux modules.
export const getEffectiveWindow = (qr) => {
  if (!qr?.activatedAt) {
    return { validFrom: null, validUntil: null };
  }

  const validFrom = new Date(qr.activatedAt);
  const validUntil = new Date(validFrom.getTime() + qr.durationMinutes * 60000);

  return { validFrom, validUntil };
};
