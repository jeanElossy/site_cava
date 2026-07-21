import { useState } from "react";

import { Link, useSearchParams } from "react-router-dom";

import { CheckCircle2, XCircle } from "lucide-react";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import { newsletter } from "../../services/api";

import usePageMeta from "../../hooks/usePageMeta";

import "./Unsubscribe.scss";

// Page de désinscription à la lettre d'information.
//
// Obligatoire dès lors qu'un envoi est fait : sans lien de
// désinscription fonctionnel, un message d'information devient
// juridiquement un courrier non sollicité.
//
// La désinscription n'est PAS déclenchée au chargement de la page.
// Les logiciels de messagerie et les antivirus visitent les liens des
// e-mails pour les analyser : une désinscription automatique
// désabonnerait des personnes qui n'ont jamais cliqué. Un clic
// explicite est donc exigé.
const Unsubscribe = () => {
  usePageMeta({
    title: "Désinscription à la lettre d'information",
    description:
      "Se désinscrire de la lettre d'information du Centre Apostolique Vie et Abondance.",
  });

  const [params] = useSearchParams();

  const token = params.get("token");

  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  const handleUnsubscribe = async () => {
    setState("busy");
    setError("");

    try {
      await newsletter.unsubscribe(token);

      setState("done");
    } catch (caught) {
      setError(
        caught?.message ??
          "La désinscription n'a pas pu aboutir."
      );

      setState("error");
    }
  };

  return (
    <>
      <Navbar />

      <main className="unsubscribe">
        <div className="unsubscribe__card">
          {!token && (
            <>
              <XCircle
                className="unsubscribe__icon unsubscribe__icon--error"
                aria-hidden="true"
              />

              <h1>Lien incomplet</h1>

              <p>
                Ce lien ne contient pas les informations nécessaires à
                votre désinscription. Utilisez celui figurant en bas de
                l&apos;e-mail que vous avez reçu.
              </p>
            </>
          )}

          {token && state !== "done" && (
            <>
              <h1>Se désinscrire</h1>

              <p>
                Vous ne recevrez plus les actualités du Centre
                Apostolique Vie et Abondance. Vous pourrez vous
                réinscrire à tout moment depuis le site.
              </p>

              {error && (
                <p
                  className="unsubscribe__error"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleUnsubscribe}
                disabled={state === "busy"}
                aria-busy={state === "busy"}
              >
                {state === "busy"
                  ? "Désinscription…"
                  : "Confirmer ma désinscription"}
              </button>
            </>
          )}

          {state === "done" && (
            <>
              <CheckCircle2
                className="unsubscribe__icon"
                aria-hidden="true"
              />

              <h1>C&apos;est fait</h1>

              <p>
                Vous êtes désinscrit et ne recevrez plus nos
                actualités. Merci pour le temps passé avec nous.
              </p>

              <Link
                to="/"
                className="unsubscribe__link"
              >
                Retour à l&apos;accueil
              </Link>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Unsubscribe;
