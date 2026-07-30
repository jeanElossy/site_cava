import { useEffect, useState } from "react";

import { members } from "../services/api";

// Même logique que usePendingSubmissionsCount : un sondage régulier
// tient le compteur à jour au fil des inscriptions validées, sans
// recharger la page.
const POLL_INTERVAL_MS = 30000;

// `null` tant que le premier chargement n'est pas arrivé : évite
// d'afficher un badge "0" trompeur avant que la vraie valeur soit
// connue. `limit: 1` : seul `meta.total` nous intéresse ici.
const useMembersCount = () => {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      members
        .listAdminPaged({ limit: 1 })
        .then(({ meta }) => {
          if (!cancelled) setCount(meta?.total ?? 0);
        })
        // Silencieux, comme usePendingSubmissionsCount : la valeur
        // précédente reste affichée jusqu'au prochain succès.
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

export default useMembersCount;
