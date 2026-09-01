import { useCallback, useEffect, useState } from "react";

import MonitorLogin from "./MonitorLogin";
import MonitorFirstPassword from "./MonitorFirstPassword";
import MonitorHome from "./MonitorHome";
import MonitorRollCall from "./MonitorRollCall";

import { currentUser, refresh, signOut } from "../../services/auth";
import { getToken } from "../../services/http";

import usePageMeta from "../../hooks/usePageMeta";

import "./Monitor.scss";

/**
 * Espace moniteur — coquille mobile de l'École du dimanche.
 *
 * ------------------------------------------------------------------
 * POURQUOI HORS DE /admin
 * ------------------------------------------------------------------
 * Un moniteur ne fait qu'une chose, depuis un téléphone, dans une
 * salle de classe : l'appel. La barre latérale de l'administration,
 * ses tableaux denses et ses formulaires n'ont pas de sens à cet
 * endroit — et l'y faire entrer l'exposerait à des écrans qu'il n'a
 * pas le droit de voir.
 *
 * Même montage que /presences pour le badgeage : coquille séparée,
 * sous le même interrupteur `VITE_ENABLE_ADMIN`, mais la MÊME
 * authentification que l'administration. Un moniteur est un compte
 * ordinaire ; c'est l'API qui restreint ce qu'il obtient, pas un
 * second mécanisme de connexion.
 */
const Monitor = () => {
  usePageMeta({
    title: "Espace moniteur — CAVA",
    description:
      "Espace réservé aux moniteurs et monitrices de l'École du dimanche.",
  });

  // « login » → « password » (mot de passe temporaire) → « home »
  const [stage, setStage] = useState(() =>
    getToken() && currentUser() ? "home" : "login"
  );

  const [pending, setPending] = useState(null);
  const [session, setSession] = useState(() => currentUser());

  // Écran d'appel en cours, le cas échéant.
  const [rollCall, setRollCall] = useState(null);

  // Revalide la session au chargement : un jeton expiré, ou un compte
  // dont le mot de passe vient d'être réinitialisé par l'administration,
  // doit ramener à la connexion plutôt qu'à des écrans vides.
  useEffect(() => {
    if (stage !== "home") return;

    refresh().then((user) => {
      if (user) {
        setSession(user);
      } else {
        setStage("login");
      }
    });
  }, [stage]);

  const onSignedIn = useCallback((result) => {
    if (result.passwordChangeRequired) {
      setPending(result);
      setStage("password");

      return;
    }

    setSession(result.user);
    setStage("home");
  }, []);

  const onPasswordChanged = useCallback((result) => {
    setPending(null);
    setSession(result.user);
    setStage("home");
  }, []);

  const onSignOut = useCallback(() => {
    signOut();
    setSession(null);
    setRollCall(null);
    setStage("login");
  }, []);

  return (
    <div className="monitor-app">
      {stage === "login" && <MonitorLogin onSignedIn={onSignedIn} />}

      {stage === "password" && (
        <MonitorFirstPassword
          pending={pending}
          onChanged={onPasswordChanged}
          onCancel={onSignOut}
        />
      )}

      {stage === "home" && !rollCall && (
        <MonitorHome
          user={session}
          onOpenRollCall={setRollCall}
          onSignOut={onSignOut}
        />
      )}

      {stage === "home" && rollCall && (
        <MonitorRollCall
          target={rollCall}
          onClose={() => setRollCall(null)}
        />
      )}
    </div>
  );
};

export default Monitor;
