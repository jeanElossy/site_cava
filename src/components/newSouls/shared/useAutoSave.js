import { useEffect, useRef, useState } from "react";

// Ne renvoie que les clés de premier niveau dont la valeur a changé
// depuis le dernier instantané sauvegardé. Deux raisons, pas une
// seule optimisation :
//   1. Le SOA et la CANA n'ont pas le même droit d'écriture sur les
//      mêmes clés de `cana.*` (voir COORDINATEUR_WRITABLE_FIELDS côté
//      serveur) — envoyer l'objet entier à chaque sauvegarde ferait
//      échouer TOUTE sauvegarde d'un coordonnateur dès qu'un champ
//      hors de son périmètre a déjà été rempli par la CANA.
//   2. Deux personnes peuvent avoir le même dossier ouvert en même
//      temps sur des étapes différentes : renvoyer l'objet complet
//      écraserait silencieusement les champs que l'autre vient de
//      sauvegarder, même si cet écran ne les a pas touchés.
const diffChangedKeys = (previous, next) => {
  const patch = {};

  for (const key of Object.keys(next)) {
    if (JSON.stringify(next[key]) !== JSON.stringify(previous?.[key])) {
      patch[key] = next[key];
    }
  }

  return patch;
};

// Sauvegarde automatique par étape, debounced : évite la perte de
// saisie si l'agent est interrompu, sans envoyer une requête à chaque
// frappe. `save(patch)` reçoit UNIQUEMENT les clés modifiées et doit
// renvoyer une promesse.
export const useAutoSave = (data, save, { delay = 900 } = {}) => {
  const [saveState, setSaveState] = useState("idle");
  const lastSaved = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (lastSaved.current === null) {
      lastSaved.current = data;

      return undefined;
    }

    const patch = diffChangedKeys(lastSaved.current, data);

    if (Object.keys(patch).length === 0) return undefined;

    setSaveState("saving");

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await save(patch);
        lastSaved.current = data;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, delay);

    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return saveState;
};
