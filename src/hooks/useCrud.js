import { useCallback, useState } from "react";

import useAsyncData from "./useAsyncData";

/**
 * Pilote un CRUD complet sur une collection de `services/api.js`.
 *
 * Expose les états que chaque écran d'administration doit gérer :
 *  - `loading` / `error` : lecture initiale de la liste ;
 *  - `busy` / `actionError` : écriture en cours (création, mise à jour,
 *    suppression), qui ne doit pas faire disparaître la liste affichée.
 *
 * Après chaque écriture, la liste est rechargée depuis l'API plutôt que
 * modifiée localement : c'est ce que fera un vrai backend, et cela évite
 * de faire diverger l'affichage de la source de vérité.
 */
// `params` (recherche, statut, pagination, filtres…) : objet simple,
// comparé par sa forme sérialisée plutôt que par référence — sinon un
// objet littéral recréé à chaque rendu de l'écran appelant relancerait
// le chargement en boucle, même quand son CONTENU n'a pas changé.
//
// `listAdminPaged` et non `listAdmin` : cette dernière force
// `limit: 100`, or l'API plafonne à 100 (crud.service.js#MAX_LIMIT).
// Passé ce seuil, la liste était donc TRONQUÉE EN SILENCE et les
// éléments suivants inatteignables — l'annuaire des membres affichait
// les 100 premiers noms par ordre alphabétique et rien d'autre. Les
// métadonnées de pagination remontent maintenant jusqu'à l'écran, qui
// affiche une navigation entre pages.
const useCrud = (resource, params = {}) => {
  const serializedParams = JSON.stringify(params);

  // `listAdmin` et non `list` : la route publique ne renvoie que le
  // contenu publié. L'administration doit voir aussi les brouillons et
  // les archives, sinon elle ne peut pas les rouvrir.
  const load = useCallback(
    () => resource.listAdminPaged(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resource, serializedParams]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Détail champ par champ d'une erreur de validation (422). L'API le
  // renvoie depuis toujours (`error.details`), mais il était jeté ici :
  // l'écran n'affichait qu'un « Les données envoyées sont invalides »
  // qui ne disait pas QUEL champ refuser.
  const [actionDetails, setActionDetails] = useState(null);

  const run = useCallback(
    async (operation, fallbackMessage) => {
      setBusy(true);
      setActionError(null);
      setActionDetails(null);

      try {
        const result = await operation();

        await reload();

        return result;
      } catch (caught) {
        setActionError(caught?.message ?? fallbackMessage);
        setActionDetails(caught?.details ?? null);

        return null;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const create = useCallback(
    (payload) =>
      run(
        () => resource.create(payload),
        "L'enregistrement a échoué."
      ),
    [resource, run]
  );

  const update = useCallback(
    (id, patch) =>
      run(
        () => resource.update(id, patch),
        "La mise à jour a échoué."
      ),
    [resource, run]
  );

  const remove = useCallback(
    (id) =>
      run(
        () => resource.remove(id),
        "La suppression a échoué."
      ),
    [resource, run]
  );

  return {
    items: data?.items ?? [],
    meta: data?.meta ?? null,
    loading,
    error,
    reload,
    busy,
    actionError,
    actionDetails,
    clearActionError: () => {
      setActionError(null);
      setActionDetails(null);
    },
    create,
    update,
    remove,
  };
};

export default useCrud;
