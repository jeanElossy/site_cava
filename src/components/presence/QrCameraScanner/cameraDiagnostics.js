// Diagnostic caméra : journal structuré ([Camera] / [Scanner]) et
// relevé des faits utiles (support, autorisation, caméras, erreur…),
// affichés par <CameraDiagnostics />.
//
// DÉSACTIVÉ en production : il ne s'allume qu'en `npm run dev`, ou sur
// une build faite avec VITE_CAMERA_DIAGNOSTICS=true — le temps de
// tester le badgeage sur les téléphones des agents, puis on retire la
// variable et on redéploie. Désactivé, chaque fonction rend la main
// immédiatement : aucun log, aucun calcul.
//
// Un seul magasin pour la page, au niveau du module : il n'y a jamais
// qu'un scanner monté à la fois, et le panneau le relit à intervalle
// régulier plutôt que de forcer un rendu à chaque image décodée.
export const CAMERA_DIAGNOSTICS =
  import.meta.env.VITE_CAMERA_DIAGNOSTICS === "true" ||
  (import.meta.env.DEV && import.meta.env.MODE !== "test");

const MAX_LOG_LINES = 40;

const store = { logs: [], facts: {} };

const formatData = (data) => {
  if (data === undefined) return "";
  if (typeof data === "string") return data;

  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
};

export const logCamera = (scope, event, data) => {
  if (!CAMERA_DIAGNOSTICS) return;

  const at = new Date().toISOString().slice(11, 23);

  store.logs = [
    ...store.logs.slice(-(MAX_LOG_LINES - 1)),
    { at, scope, event, data: formatData(data) },
  ];

  console.info(`[${scope}] ${event}`, data ?? "");
};

export const setCameraFacts = (patch) => {
  if (!CAMERA_DIAGNOSTICS) return;

  store.facts = { ...store.facts, ...patch };
};

export const readCameraDiagnostics = () => store;
