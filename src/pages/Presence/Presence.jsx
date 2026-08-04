import { useState } from "react";

import usePageMeta from "../../hooks/usePageMeta";

import {
  clearPresenceSession,
  getPresenceSession,
  setPresenceSession,
} from "../../services/presences";

import PresenceLogin from "./PresenceLogin";
import PresenceWelcome from "./PresenceWelcome";
import PresenceScanner from "./PresenceScanner";

import "./Presence.scss";

// Préférence de thème CLAIR/SOMBRE — indépendante de celle de
// l'administration (clé distincte) : deux publics différents, deux
// réglages qui n'ont aucune raison de se confondre. Même logique que
// AdminLayout.jsx : un choix explicite (bouton) traverse les sessions
// et l'emporte sur `prefers-color-scheme` ; tant qu'aucun choix n'a
// été posé, c'est la préférence système qui décide.
const THEME_KEY = "presence-theme";

const getInitialTheme = () => {
  const stored = window.localStorage.getItem(THEME_KEY);

  if (stored === "dark" || stored === "light") return stored;

  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
};

// Page de badgeage des présences — voir docs/superpowers/specs/
// 2026-08-04-badgeage-presences-design.md pour la conception complète.
//
// Trois phases, jamais mélangées : "login" (QR de sécurité + matricule),
// "welcome" (transition automatique, aucune action requise), "scanning"
// (module de badgeage continu). Une session existante en sessionStorage
// saute directement en "scanning" — mais chaque appel API la revérifie
// côté serveur (voir requirePresenceSession) : une session localement
// présente mais révoquée entre-temps est rejetée au premier scan.
const Presence = () => {
  usePageMeta({
    title: "Badgeage des présences",
    description: "Espace réservé aux agents du Service d'Ordre du CAVA.",
  });

  // État initial dérivé directement de sessionStorage plutôt que d'un
  // effet : une session déjà présente au premier rendu doit sauter
  // l'écran de connexion sans un aller-retour visible par "login".
  const [phase, setPhase] = useState(() =>
    getPresenceSession()?.sessionToken ? "scanning" : "login"
  );
  const [session, setSession] = useState(() => getPresenceSession());
  const [theme, setTheme] = useState(getInitialTheme);

  const toggleTheme = () => {
    setTheme((previous) => {
      const next = previous === "dark" ? "light" : "dark";

      window.localStorage.setItem(THEME_KEY, next);

      return next;
    });
  };

  const handleAuthenticated = (result) => {
    const nextSession = {
      sessionToken: result.sessionToken,
      agent: result.agent,
      qr: result.qr,
    };

    setPresenceSession(nextSession);
    setSession(nextSession);
    setPhase("welcome");
  };

  const handleWelcomeDone = () => setPhase("scanning");

  const handleLogout = () => {
    clearPresenceSession();
    setSession(null);
    setPhase("login");
  };

  // Une session rejetée par le serveur (QR revoqué, agent désactivé —
  // voir requirePresenceSession) ramène systématiquement à l'écran de
  // connexion, jamais à un état intermédiaire incohérent.
  const handleSessionRejected = () => handleLogout();

  return (
    <div
      className="presence-app"
      data-theme={theme}
    >
      {phase === "login" && (
        <PresenceLogin
          theme={theme}
          onToggleTheme={toggleTheme}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {phase === "welcome" && (
        <PresenceWelcome
          agent={session.agent}
          onDone={handleWelcomeDone}
        />
      )}

      {phase === "scanning" && (
        <PresenceScanner
          session={session}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          onSessionRejected={handleSessionRejected}
        />
      )}
    </div>
  );
};

export default Presence;
