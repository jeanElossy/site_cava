import { useEffect, useState } from "react";

import { memberSubmissions } from "../services/api";

// Interrogé à intervalle régulier plutôt qu'une fois au montage : c'est
// ce qui permet au badge de rester à jour (nouvelle demande, ou demande
// traitée dans un autre onglet) sans recharger la page.
const POLL_INTERVAL_MS = 30000;

// `limit: 1` : seul `meta.total` nous intéresse ici, pas les éléments.
const usePendingSubmissionsCount = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      memberSubmissions
        .list({ limit: 1 })
        .then(({ meta }) => {
          if (!cancelled) setCount(meta?.total ?? 0);
        })
        // Silencieux : un jeton expiré ou un réseau instable ne doit
        // pas faire disparaître le badge ni polluer la console — la
        // valeur précédente reste affichée jusqu'au prochain succès.
        .catch(() => {});
    };

    load();

    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return count;
};

export default usePendingSubmissionsCount;
