import AuditLog from "../models/AuditLog.js";

// Écriture du journal d'audit.
//
// RÈGLE : journaliser ne doit JAMAIS faire échouer l'action métier.
// Si l'écriture de la trace échoue (base saturée, index en cours de
// construction), on enregistre l'incident dans la sortie serveur et
// on laisse la requête aboutir. Un journal indisponible ne doit pas
// empêcher l'église de publier un événement.
export const record = async (
  req,
  { action, resource, resourceId, actor } = {}
) => {
  const who = actor ?? req?.user;

  if (!who) return;

  try {
    await AuditLog.create({
      actor: who.id,
      actorEmail: who.email,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : undefined,
      ip: req?.ip,
      userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
    });
  } catch (error) {
    console.error(
      "[audit] écriture impossible :",
      error.message
    );
  }
};

// Variante pour les échecs de connexion, où il n'y a pas encore
// d'utilisateur authentifié. On journalise l'adresse tentée pour
// permettre de détecter une attaque ciblée.
export const recordLoginAttempt = async (
  req,
  { email, success, actorId }
) => {
  try {
    await AuditLog.create({
      ...(actorId ? { actor: actorId } : {}),
      actorEmail: String(email ?? "inconnu")
        .toLowerCase()
        .slice(0, 160),
      action: success ? "login" : "login_failed",
      ip: req?.ip,
      userAgent: req?.headers?.["user-agent"]?.slice(0, 300),
    });
  } catch (error) {
    console.error(
      "[audit] écriture impossible :",
      error.message
    );
  }
};
