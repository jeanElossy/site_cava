import { useEffect } from "react";

import { CheckCircle2 } from "lucide-react";

// Transition automatique après une connexion réussie — aucune action
// requise de l'agent, conformément à la spec ("bascule automatique sur
// le module de scan continu, sans rechargement").
const WELCOME_DELAY_MS = 1600;

const PresenceWelcome = ({ agent, onDone }) => {
  useEffect(() => {
    const timer = window.setTimeout(onDone, WELCOME_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="presence-welcome">
      <div className="presence-welcome__badge">
        <CheckCircle2 aria-hidden="true" />
      </div>

      <h1>
        Bienvenue {agent.firstName} {agent.lastName}
      </h1>

      <p>Accès autorisé</p>

      <span>Vous pouvez commencer le badgeage</span>
    </div>
  );
};

export default PresenceWelcome;
