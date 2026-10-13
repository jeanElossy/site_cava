import { useCallback, useEffect, useRef, useState } from "react";

// DÉCONNEXION APRÈS INACTIVITÉ — espace d'administration.
//
// La session dure plusieurs jours côté serveur, et l'administration
// s'ouvre sur des ordinateurs partagés (secrétariat, régie) : un poste
// laissé allumé donnait accès à l'annuaire des membres, aux enfants et
// à la caisse sociale à quiconque passait devant.
//
// L'horodatage de dernière activité vit dans le localStorage, PAS dans
// l'onglet : un administrateur qui travaille dans un onglet ne doit pas
// être déconnecté par un autre, resté ouvert en arrière-plan, qui se
// croirait inactif (la déconnexion efface le jeton commun à tous les
// onglets).
//
// C'est une protection de POSTE, pas d'API : un jeton volé reste valable
// jusqu'à son expiration serveur (`JWT_EXPIRES_IN`).

export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;

const ACTIVITY_KEY = "cava:admin-last-activity";

// Écrire à chaque frappe saturerait le stockage : une écriture toutes
// les 10 s suffit, l'échéance se compte en minutes.
const WRITE_THROTTLE_MS = 10 * 1000;
const CHECK_INTERVAL_MS = 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"];

/**
 * État d'inactivité à un instant donné — fonction pure, testée seule.
 *
 * @returns {{ phase: "active" | "warning" | "expired", secondsLeft: number }}
 */
export const idleState = (
  now,
  lastActivity,
  limit = IDLE_LIMIT_MS,
  warning = IDLE_WARNING_MS
) => {
  const remaining = limit - (now - lastActivity);

  if (remaining <= 0) return { phase: "expired", secondsLeft: 0 };

  if (remaining <= warning) {
    return { phase: "warning", secondsLeft: Math.ceil(remaining / 1000) };
  }

  return { phase: "active", secondsLeft: Math.ceil(remaining / 1000) };
};

const readShared = () => {
  try {
    const value = Number(window.localStorage.getItem(ACTIVITY_KEY));

    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeShared = (value) => {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(value));
  } catch {
    /* stockage indisponible : l'onglet garde sa propre mesure */
  }
};

/**
 * @param {() => void} onExpire appelé une seule fois à l'échéance
 * @returns {{ warning: boolean, secondsLeft: number, stayActive: () => void }}
 */
const useIdleTimeout = (onExpire, { limit = IDLE_LIMIT_MS, warning = IDLE_WARNING_MS } = {}) => {
  const lastRef = useRef(0);
  const lastWriteRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  const [state, setState] = useState({ phase: "active", secondsLeft: 0 });

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const markActivity = useCallback((force = false) => {
    const now = Date.now();

    lastRef.current = now;

    if (force || now - lastWriteRef.current >= WRITE_THROTTLE_MS) {
      lastWriteRef.current = now;
      writeShared(now);
    }
  }, []);

  useEffect(() => {
    // Une ouverture compte comme une activité : sans quoi un onglet
    // rouvert après une heure se fermerait aussitôt sur l'horodatage
    // de la veille.
    markActivity(true);

    const onActivity = () => markActivity();

    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, onActivity, { passive: true })
    );

    const timer = window.setInterval(() => {
      if (expiredRef.current) return;

      const last = Math.max(lastRef.current, readShared());
      const next = idleState(Date.now(), last, limit, warning);

      if (next.phase === "expired") {
        expiredRef.current = true;
        onExpireRef.current?.();
      }

      // Seuls les changements visibles re-rendent : en phase active, le
      // compte à rebours n'est pas affiché.
      setState((previous) =>
        previous.phase === next.phase &&
        (next.phase !== "warning" || previous.secondsLeft === next.secondsLeft)
          ? previous
          : next
      );
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, onActivity)
      );
      window.clearInterval(timer);
    };
  }, [markActivity, limit, warning]);

  return {
    warning: state.phase === "warning",
    secondsLeft: state.secondsLeft,
    stayActive: () => markActivity(true),
  };
};

export default useIdleTimeout;
