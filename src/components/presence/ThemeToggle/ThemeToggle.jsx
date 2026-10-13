import { Moon, Sun } from "lucide-react";

import "./ThemeToggle.scss";

// Bascule claire/sombre des pages publiques de badgeage (voir
// Presence.jsx pour la persistance et la préférence système initiale).
// Distinct du thème de l'administration : deux publics différents, deux
// réglages indépendants.
//
// `inline` : bouton posé dans le flux (barre de session du scanner) au
// lieu d'être fixé dans le coin — fixé, il recouvrait la carte
// d'en-tête du scanner sur téléphone.
const ThemeToggle = ({ theme, onToggle, inline = false }) => (
  <button
    type="button"
    className={
      inline
        ? "presence-theme-toggle presence-theme-toggle--inline"
        : "presence-theme-toggle"
    }
    onClick={onToggle}
    aria-label={
      theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"
    }
    title={
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
