import { useCallback, useEffect, useRef, useState } from "react";

import { members } from "../services/api";

// Même logique que usePendingSubmissionsCount : un sondage régulier
// tient le compteur à jour au fil des inscriptions validées, sans
// recharger la page. Le `refresh` renvoyé permet en plus à l'appelant
// de forcer une mise à jour immédiate après une action qu'il connaît
// déjà (ex. désactivation d'un membre) — sans ça, la valeur affichée
// resterait périmée jusqu'au prochain sondage (30 secondes).
const POLL_INTERVAL_MS = 30000;

// `null` tant que le premier chargement n'est pas arrivé : évite
// d'afficher un badge "0" trompeur avant que la vraie valeur soit
// connue. `limit: 1` : seul `meta.total` nous intéresse ici.
//
// `params` (ex. `{ status: "actif" }`) est comparé par sa forme
// sérialisée, pas par référence — un objet littéral recréé à chaque
// rendu de l'écran appelant ne doit pas relancer le sondage en boucle.
const useMembersCount = (params = {}) => {
  const [count, setCount] = useState(null);
  const serializedParams = JSON.stringify(params);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    members
      .listAdminPaged({ limit: 1, ...JSON.parse(serializedParams) })
      .then(({ meta }) => {
        if (mountedRef.current) setCount(meta?.total ?? 0);
      })
      // Silencieux, comme usePendingSubmissionsCount : la valeur
      // précédente reste affichée jusqu'au prochain succès.
      .catch(() => {});
  }, [serializedParams]);

  useEffect(() => {
    mountedRef.current = true;
    load();

    const interval = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  return [count, load];
};

export default useMembersCount;
