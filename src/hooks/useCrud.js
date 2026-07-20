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
const useCrud = (resource) => {
  // `listAdmin` et non `list` : la route publique ne renvoie que le
  // contenu publié. L'administration doit voir aussi les brouillons et
  // les archives, sinon elle ne peut pas les rouvrir.
  //
  // Fonction de portée module (voir la fabrique `collection` de
  // services/api.js) : stable, donc utilisable sans `useCallback`.
  const { data, loading, error, reload } = useAsyncData(
    resource.listAdmin
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const run = useCallback(
    async (operation, fallbackMessage) => {
      setBusy(true);
      setActionError(null);

      try {
        const result = await operation();

        await reload();

        return result;
      } catch (caught) {
        setActionError(caught?.message ?? fallbackMessage);

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
    items: data ?? [],
    loading,
    error,
    reload,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    create,
    update,
    remove,
  };
};

export default useCrud;
