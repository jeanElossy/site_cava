import { useEffect, useState } from "react";

import { apiBaseUrl } from "../../../services/http";

import "./ApiStatus.scss";

// Indicateur d'état de l'API.
//
// Remplace l'ancien bandeau « cet espace n'est relié à aucun serveur »,
// devenu faux depuis le branchement du backend. Plutôt que d'affirmer
// quelque chose en dur — ce qui finit toujours par mentir — cet
// indicateur interroge réellement l'API et rapporte ce qu'il constate.
//
// Utile en pratique : sur l'offre gratuite de Render, le service
// s'endort après 15 minutes et met environ 50 secondes à se réveiller.
// Sans ce repère, un premier chargement lent ressemble à une panne.
const ApiStatus = () => {
  const [state, setState] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (!cancelled) setState((s) => (s === "online" ? s : "checking"));

      try {
        const response = await fetch(`${apiBaseUrl}/api/health`, {
          // Pas de jeton : cette route est publique, et l'indicateur
          // doit fonctionner même si la session a expiré.
          headers: { Accept: "application/json" },
        });

        if (cancelled) return;

        setState(response.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setState("offline");
      }
    };

    ping();

    // Vérification périodique discrète. 60 secondes : assez pour
    // repérer une coupure, assez espacé pour ne pas maintenir le
    // service éveillé artificiellement ni consommer le quota.
    const timer = setInterval(ping, 60_000);

    return () => {
      cancelled = true;

      clearInterval(timer);
    };
  }, []);

  const LABELS = {
    checking: "Connexion…",
    online: "Connecté",
    offline: "Hors ligne",
  };

  const TITLES = {
    checking: `Vérification de ${apiBaseUrl}`,
    online: `Connecté à ${apiBaseUrl}`,
    offline: `Aucune réponse de ${apiBaseUrl}. Sur l'offre gratuite, le service met environ 50 secondes à se réveiller.`,
  };

  return (
    <p
      className={`admin-api-status admin-api-status--${state}`}
      title={TITLES[state]}
    >
      <span
        className="admin-api-status__dot"
        aria-hidden="true"
      />

      <span>{LABELS[state]}</span>
    </p>
  );
};

export default ApiStatus;
