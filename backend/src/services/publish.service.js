import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Déclenchement d'une reconstruction du site public.
//
// POURQUOI CÔTÉ SERVEUR : l'URL du webhook Vercel est un secret de
// fait. Quiconque la connaît peut déclencher des builds à volonté —
// consommation de quota, voire déni de service sur les déploiements.
// Placée dans le front, elle serait lisible dans le bundle par
// n'importe quel visiteur. Elle reste donc ici, en variable
// d'environnement du backend, et l'admin passe par une route
// authentifiée.

// Intervalle minimal entre deux publications. Une reconstruction dure
// une à deux minutes : enchaîner les déclenchements ne sert à rien et
// consomme du quota. Le compteur est en mémoire, ce qui suffit pour un
// garde-fou d'ergonomie (il se réinitialise au redémarrage).
const COOLDOWN_MS = 60 * 1000;

let lastTriggeredAt = 0;

export const publish = async () => {
  if (!env.VERCEL_DEPLOY_HOOK) {
    throw ApiError.badRequest(
      "La publication n'est pas configurée : la variable VERCEL_DEPLOY_HOOK est absente côté serveur."
    );
  }

  const elapsed = Date.now() - lastTriggeredAt;

  if (elapsed < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);

    throw ApiError.tooManyRequests(
      `Une publication vient d'être lancée. Merci de patienter ${wait} seconde(s).`
    );
  }

  let response;

  try {
    response = await fetch(env.VERCEL_DEPLOY_HOOK, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      502,
      "Impossible de joindre le service de déploiement. Réessayez dans un instant."
    );
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      `Le service de déploiement a refusé la demande (code ${response.status}).`
    );
  }

  lastTriggeredAt = Date.now();

  return {
    triggeredAt: new Date().toISOString(),
    // Volontairement indicatif : Vercel ne renvoie pas de durée ferme.
    estimatedMinutes: 2,
  };
};
