import Subscriber from "../models/Subscriber.js";
import { ApiError } from "../utils/ApiError.js";

// Lettre d'information.
//
// Le formulaire du pied de page affichait « inscription confirmée »
// sans rien enregistrer : les visiteurs se croyaient abonnés et ne
// l'étaient pas. Ce service donne à cette promesse un contenu réel.

export const subscribe = async ({ email, name, source, ip }) => {
  const clean = String(email ?? "")
    .toLowerCase()
    .trim();

  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw ApiError.badRequest(
      "Merci de saisir une adresse e-mail valide."
    );
  }

  const existing = await Subscriber.findOne({ email: clean });

  if (existing) {
    // Déjà inscrit : on répond avec succès plutôt qu'une erreur.
    //
    // Renvoyer « cette adresse est déjà inscrite » transformerait le
    // formulaire en outil de vérification : n'importe qui pourrait
    // tester des adresses pour savoir lesquelles appartiennent à des
    // membres de l'église. La réponse est donc identique dans les deux
    // cas.
    if (existing.status === "unsubscribed") {
      existing.status = "confirmed";
      existing.unsubscribedAt = undefined;
      existing.consentAt = new Date();
      existing.consentIp = ip;

      await existing.save();
    }

    return { alreadySubscribed: true };
  }

  await Subscriber.create({
    email: clean,
    name: name?.trim() || undefined,
    source: source ?? "footer",
    consentIp: ip,
    confirmedAt: new Date(),
  });

  return { alreadySubscribed: false };
};

// Désinscription par jeton. Volontairement accessible sans
// authentification : exiger une connexion pour se désabonner rendrait
// le lien inutilisable, et l'envoi juridiquement fautif.
export const unsubscribe = async (token) => {
  if (!token || typeof token !== "string") {
    throw ApiError.badRequest("Lien de désinscription invalide.");
  }

  const subscriber = await Subscriber.findOne({
    unsubscribeToken: token,
  });

  if (!subscriber) {
    throw ApiError.notFound(
      "Ce lien de désinscription n'est plus valide."
    );
  }

  if (subscriber.status !== "unsubscribed") {
    subscriber.status = "unsubscribed";
    subscriber.unsubscribedAt = new Date();

    await subscriber.save();
  }

  return { email: subscriber.email };
};

export const listAdmin = async (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10));

  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(query.limit ?? "50", 10))
  );

  const filter = {};

  if (
    ["pending", "confirmed", "unsubscribed"].includes(query.status)
  ) {
    filter.status = query.status;
  }

  if (query.search) {
    // Échappement des métacaractères : sans lui, une saisie comme
    // « a+ » produirait une expression invalide, et « .* » ferait
    // parcourir toute la collection.
    const safe = String(query.search).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    filter.email = { $regex: safe, $options: "i" };
  }

  const [items, total, confirmed] = await Promise.all([
    Subscriber.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Subscriber.countDocuments(filter),
    Subscriber.countDocuments({ status: "confirmed" }),
  ]);

  return {
    items: items.map(({ unsubscribeToken, ...rest }) => rest),
    meta: { page, limit, total, confirmed },
  };
};

export const remove = async (id) => {
  const deleted = await Subscriber.findByIdAndDelete(id);

  if (!deleted) {
    throw ApiError.notFound("Abonné introuvable.");
  }

  return true;
};

// Export CSV, pour alimenter un service d'envoi le jour venu.
//
// Seules les adresses confirmées sont exportées : inclure les
// désinscrits reviendrait à leur réécrire, ce qu'ils ont refusé.
export const exportCsv = async () => {
  const rows = await Subscriber.find({ status: "confirmed" })
    .sort({ createdAt: 1 })
    .select("email name createdAt")
    .lean();

  const escape = (value) => {
    const text = String(value ?? "");

    // Préfixe défensif contre l'injection de formule : une valeur
    // commençant par =, +, - ou @ est interprétée comme une formule
    // par Excel et LibreOffice à l'ouverture du fichier.
    const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;

    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const header = "email,nom,inscrit_le";

  const lines = rows.map((row) =>
    [
      escape(row.email),
      escape(row.name),
      escape(new Date(row.createdAt).toISOString().slice(0, 10)),
    ].join(",")
  );

  return [header, ...lines].join("\n");
};
