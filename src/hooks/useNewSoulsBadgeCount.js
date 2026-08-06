import { useEffect, useState } from "react";

import { newSouls } from "../services/api";
import { currentUser } from "../services/auth";

// Interrogé à intervalle régulier, comme usePendingSubmissionsCount :
// c'est ce qui permet au badge de rester à jour (nouveau dossier
// SOA, dossier transmis par un autre agent…) sans recharger la page.
const POLL_INTERVAL_MS = 30000;

// Un seul nombre par rôle, celui qui correspond à "ce qu'il reste à
// faire" pour CE compte sur le lien "Nouvelles âmes" du menu :
//   - soa : dossiers pas encore transmis (`soaPending`) ;
//   - cana/coordinateur_bergeries/pasteur : dossiers transmis jamais
//     ouverts + suivis mensuels à venir sous 14 jours ;
//   - admin : les deux combinés, puisqu'il voit tout le périmètre.
const badgeCountFor = (role, stats) => {
  if (!stats) return 0;

  if (role === "soa") return stats.soaPending ?? 0;

  const canaSide = (stats.awaitingAcknowledgement ?? 0) + (stats.upcomingFollowUps?.length ?? 0);

  if (role === "admin") return (stats.soaPending ?? 0) + canaSide;

  return canaSide;
};

const useNewSoulsBadgeCount = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      newSouls
        .stats()
        .then((stats) => {
          if (!cancelled) setCount(badgeCountFor(currentUser()?.role, stats));
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

export default useNewSoulsBadgeCount;
