import { useEffect } from "react";

const SITE_NAME = "Centre Apostolique Vie et Abondance";

/**
 * Renseigne le <title> et la meta description de la page courante.
 *
 * Le site est une SPA sans rendu serveur : index.html ne porte qu'un
 * titre générique. Ce hook permet à chaque page d'exposer ses propres
 * métadonnées, sans dépendance supplémentaire.
 */
const usePageMeta = ({ title, description }) => {
  useEffect(() => {
    if (title) {
      document.title = `${title} | ${SITE_NAME}`;
    }

    if (description) {
      let tag = document.querySelector(
        'meta[name="description"]'
      );

      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");

        document.head.appendChild(tag);
      }

      tag.setAttribute("content", description);
    }
  }, [title, description]);
};

export default usePageMeta;
