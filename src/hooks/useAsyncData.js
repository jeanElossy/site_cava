import { useCallback, useEffect, useState } from "react";

const INITIAL = { data: null, loading: true, error: null };

/**
 * Exécute une fonction asynchrone (typiquement un appel de
 * `services/api.js`) et expose les trois états que toute lecture de
 * données doit gérer : chargement, erreur, et donnée disponible
 * (éventuellement vide).
 *
 * Le jour où `api.js` tapera un vrai backend, rien ne change ici : les
 * composants sont déjà écrits pour l'asynchrone.
 *
 * Le rechargement ne repasse volontairement pas par l'état « chargement »
 * : après une création ou une suppression, la liste déjà affichée reste
 * à l'écran le temps du rafraîchissement, au lieu de disparaître
 * derrière un indicateur pendant une fraction de seconde.
 *
 * @param {Function} loader
 *   Fonction async renvoyant la donnée. Elle doit être STABLE d'un
 *   rendu à l'autre, sinon le chargement se relance en boucle. Les
 *   méthodes de `services/api.js` conviennent telles quelles
 *   (`announcements.list`, `stats`, `settings.get`…) : ce sont des
 *   fonctions fléchées de portée module, pas des méthodes liées à
 *   `this`. Sinon, envelopper l'appel dans un `useCallback`.
 */
const useAsyncData = (loader) => {
  const [state, setState] = useState(INITIAL);
  const [token, setToken] = useState(0);

  // Rechargement EN COURS, distinct de `loading` (premier chargement).
  // Sans lui, un bouton « Actualiser » n'a strictement aucun effet
  // visible quand les données n'ont pas changé : la liste reste
  // affichée — c'est voulu, voir plus haut — mais l'utilisateur clique
  // et ne voit rien bouger, donc il conclut que le bouton est cassé.
  // Vécu tel quel sur l'écran de badgeage.
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Le composant peut être démonté (ou la donnée redemandée) avant
    // que la promesse n'aboutisse : on ignore alors le résultat.
    let cancelled = false;

    loader()
      .then((result) => {
        if (cancelled) return;

        setState({ data: result, loading: false, error: null });
      })
      .catch((caught) => {
        if (cancelled) return;

        setState({
          data: null,
          loading: false,
          error:
            caught?.message ??
            "Une erreur est survenue pendant le chargement.",
        });
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, token]);

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, error: null }));
    setRefreshing(true);
    setToken((previous) => previous + 1);
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refreshing,
    reload,
  };
};

export default useAsyncData;
