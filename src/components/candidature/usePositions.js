import { useEffect, useState } from "react";

import { positions as positionsApi } from "../../services/api";

// Chargement des postes ouverts, partagé par la grille et par le
// formulaire de la page Appel à candidatures.
//
// CACHE AU NIVEAU DU MODULE : sans lui, chacun des deux composants
// lancerait sa propre requête pour la même liste, au même instant, au
// premier affichage de la page. Le cache est volontairement simple —
// une promesse mémorisée — parce que les postes ne changent pas
// pendant une visite ; un rechargement de page suffit à les rafraîchir.
let cache = null;

const load = () => {
  // On mémorise la PROMESSE, pas seulement son résultat : deux
  // composants montés dans le même rendu arriveraient sinon tous les
  // deux avant que la première réponse soit là, et déclencheraient
  // deux appels malgré le cache.
  if (!cache) {
    cache = positionsApi.list().catch((error) => {
      // Un échec ne doit pas rester mémorisé : la visite suivante doit
      // pouvoir réessayer plutôt que de resservir l'erreur.
      cache = null;

      throw error;
    });
  }

  return cache;
};

const usePositions = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    load()
      .then((data) => {
        if (!alive) return;

        setItems(Array.isArray(data) ? data : []);
      })
      .catch((caught) => {
        if (!alive) return;

        setError(
          caught?.message ?? "Les postes n'ont pas pu être chargés."
        );
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { positions: items, isLoading, error };
};

export default usePositions;
