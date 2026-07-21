import { useState } from "react";

import { Globe, Check } from "lucide-react";

import { publish } from "../../../services/api";

import "./PublishButton.scss";

// Bouton de publication du site public.
//
// Le site est statique : ce qui est enregistré ici ne devient visible
// des visiteurs qu'après une reconstruction. Le bouton l'explique
// plutôt que de le laisser deviner — sans quoi l'équipe modifierait un
// événement, consulterait le site, ne verrait aucun changement et en
// conclurait que l'administration ne fonctionne pas.
const PublishButton = () => {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  const handlePublish = async () => {
    setState("busy");
    setMessage("");

    try {
      await publish();

      setState("done");
      setMessage(
        "Publication lancée. Le site sera à jour dans une à deux minutes."
      );
    } catch (error) {
      setState("error");
      setMessage(
        error?.message ?? "La publication a échoué."
      );
    }
  };

  return (
    <section className="publish-box">

      <div className="publish-box__text">
        <h2>Publier le site</h2>

        <p>
          Vos modifications sont enregistrées, mais elles
          n'apparaissent sur le site public qu'après une
          publication.
        </p>
      </div>

      <div className="publish-box__action">
        <button
          type="button"
          onClick={handlePublish}
          disabled={state === "busy"}
        >
          {state === "done" ? (
            <Check aria-hidden="true" />
          ) : (
            <Globe aria-hidden="true" />
          )}

          {state === "busy"
            ? "Publication en cours…"
            : "Publier maintenant"}
        </button>

        {message && (
          <p
            className={
              state === "error"
                ? "publish-box__message publish-box__message--error"
                : "publish-box__message"
            }
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}
      </div>

    </section>
  );
};

export default PublishButton;
