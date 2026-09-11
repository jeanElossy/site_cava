import { useEffect, useState } from "react";

import { readCameraDiagnostics } from "./cameraDiagnostics";

const yesNo = (value) => {
  if (value === true) return "OUI";
  if (value === false) return "NON";

  return "inconnu";
};

// Panneau de diagnostic caméra, TEMPORAIRE : rendu uniquement quand
// CAMERA_DIAGNOSTICS est vrai (voir cameraDiagnostics.js). Replié par
// défaut, sous le cadre.
//
// Le bouton « caméra seule » sépare les trois pannes possibles :
//   1. la caméra ne démarre pas (Statut ≠ ready, Erreur renseignée) ;
//   2. elle démarre mais le flux n'arrive pas (Vidéo 0×0) ;
//   3. le flux arrive mais le décodage échoue (Passes qui montent, aucun
//      QR lu). En mode caméra seule, l'aperçu doit rester fluide : s'il
//      saccade seulement avec le décodage, c'est jsQR qui est en cause.
const CameraDiagnostics = ({ decodingPaused, onToggleDecoding }) => {
  const [snapshot, setSnapshot] = useState(() => ({ ...readCameraDiagnostics() }));

  useEffect(() => {
    const timer = window.setInterval(
      () => setSnapshot({ ...readCameraDiagnostics() }),
      500
    );

    return () => window.clearInterval(timer);
  }, []);

  const facts = snapshot.facts;

  const rows = [
    ["Caméra prise en charge", yesNo(facts.mediaDevices && facts.getUserMedia)],
    ["mediaDevices", yesNo(facts.mediaDevices)],
    ["getUserMedia", yesNo(facts.getUserMedia)],
    ["HTTPS (contexte sécurisé)", `${yesNo(facts.secureContext)} — ${facts.protocol ?? "?"}`],
    ["Permissions-Policy caméra", facts.policyAllowsCamera == null ? "non exposé" : facts.policyAllowsCamera ? "autorisée" : "INTERDITE"],
    ["Autorisation", facts.permission ?? "inconnue"],
    ["Navigateur intégré", yesNo(facts.inAppBrowser)],
    ["Dans une iframe", yesNo(facts.inIframe)],
    ["Statut", facts.status ?? "—"],
    ["Caméras détectées", facts.cameras ? `${facts.cameras.length} — ${facts.cameras.join(" | ")}` : "—"],
    ["Caméra utilisée", facts.selectedCamera ?? "—"],
    ["Réglages du flux", facts.settings ?? "—"],
    ["Vidéo", facts.video ?? "—"],
    ["Décodage", facts.decodePasses ? `${facts.decodePasses} passes, dernière ${facts.lastDecodeMs} ms` : "—"],
    ["Dernier QR lu", facts.lastDecoded ?? "—"],
    ["Navigateur", facts.browser ?? "—"],
    ["User Agent", facts.userAgent ?? "—"],
    ["Erreur (name)", facts.error?.name || "—"],
    ["Erreur (message)", facts.error?.message || "—"],
    ["Erreur (constraint)", facts.error?.constraint || "—"],
  ];

  return (
    <details className="qr-camera-scanner__diagnostics">
      <summary>Diagnostic caméra (mode test)</summary>

      <button
        type="button"
        onClick={onToggleDecoding}
      >
        {decodingPaused
          ? "Test A — caméra seule (décodage en pause) · reprendre le décodage"
          : "Test B — caméra + décodage · passer en caméra seule"}
      </button>

      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>

      <ol>
        {snapshot.logs.map((line, index) => (
          <li key={`${line.at}-${index}`}>
            {line.at} [{line.scope}] {line.event} {line.data}
          </li>
        ))}
      </ol>
    </details>
  );
};

export default CameraDiagnostics;
