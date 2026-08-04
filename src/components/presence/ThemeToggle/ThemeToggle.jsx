import { Moon, Sun } from "lucide-react";

import "./ThemeToggle.scss";

// Bascule claire/sombre des pages publiques de badgeage (voir
// Presence.jsx pour la persistance et la préférence système initiale).
// Distinct du thème de l'administration : deux publics différents, deux
// réglages indépendants.
const ThemeToggle = ({ theme, onToggle }) => (
  <button
    type="button"
    className="presence-theme-toggle"
    onClick={onToggle}
    aria-label={
      theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"
    }
  >
    {theme === "dark" ? (
      <Sun aria-hidden="true" />
    ) : (
      <Moon aria-hidden="true" />
    )}
  </button>
);

export default ThemeToggle;
