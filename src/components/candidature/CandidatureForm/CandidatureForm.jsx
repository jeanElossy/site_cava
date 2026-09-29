import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";

import { inbox } from "../../../services/api";
import positions, { findPosition } from "../data/positions";

import "./CandidatureForm.scss";

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  position: "",
  skills: "",
  availability: "",
  message: "",
  consent: false,
};

// Le corps du message est assemblé ici, en texte lisible : la boîte de
// réception (/admin/messages) affiche un message, pas un formulaire
// structuré. Mieux vaut une fiche lisible à l'œil qu'un JSON que
// personne ne relira.
const buildBody = (values) =>
  [
    `Poste souhaité : ${
      findPosition(values.position)?.title ?? "Non précisé"
    }`,
    `Téléphone : ${values.phone.trim() || "—"}`,
    `E-mail : ${values.email.trim() || "—"}`,
    "",
    "Compétences :",
    values.skills.trim() || "—",
    "",
    "Disponibilités :",
    values.availability.trim() || "—",
    "",
    "Motivation :",
    values.message.trim() || "—",
  ].join("\n");

const CandidatureForm = () => {
  const [searchParams] = useSearchParams();

  // Préremplissage par l'URL, posé À L'INITIALISATION et pas dans un
  // effet : la liste des postes est locale et synchrone (contrairement
  // aux types de don, qui arrivent de l'API), il n'y a donc aucune
  // course à arbitrer. Un effet réimposerait en plus le poste de l'URL
  // par-dessus celui que le visiteur vient de choisir.
  const [values, setValues] = useState(() => {
    const requested = searchParams.get("poste");

    return {
      ...EMPTY_FORM,
      position: findPosition(requested) ? requested : "",
    };
  });

  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSending) return;

    // Au moins un moyen de rappel. Beaucoup de fidèles n'ont pas
    // d'adresse e-mail : exiger l'e-mail aurait écarté précisément les
    // candidats recherchés. L'API applique la même règle.
    if (!values.phone.trim() && !values.email.trim()) {
      setError(
        "Indiquez au moins un téléphone ou un e-mail pour que nous puissions vous recontacter."
      );

      return;
    }

    if (!values.position) {
      setError("Choisissez le poste pour lequel vous candidatez.");

      return;
    }

    if (!values.consent) {
      setError(
        "Merci d'accepter d'être contacté(e) pour que votre candidature soit étudiée."
      );

      return;
    }

    setError("");
    setIsSending(true);

    try {
      await inbox.submit({
        name: values.name.trim(),
        phone: values.phone.trim(),
        // Chaîne vide plutôt qu'absence : le service public ne retient
        // que les champs définis, et une chaîne vide n'écrit rien de
        // faux en base tout en gardant la charge utile régulière.
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        subject: `Candidature — ${
          findPosition(values.position)?.title ?? "Poste non précisé"
        }`,
        body: buildBody(values),
        // Distingue la candidature d'une question sur un ministère :
        // la boîte de réception filtre sur ce champ.
        kind: "candidature",
        consent: values.consent === true,
      });

      setIsSent(true);
    } catch (caught) {
      setError(
        caught?.message ??
          "Votre candidature n'a pas pu être enregistrée. Merci de réessayer."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="candidature-form" id="candidature-formulaire">
      <div className="candidature-form__container">
        <h2 className="candidature-form__title">
          Faites acte <span>de candidature</span>
        </h2>

        <p className="candidature-form__intro">
          Renseignez ce formulaire : le secrétariat exécutif vous
          recontactera pour la suite du processus.
        </p>

        {isSent ? (
          <div
            className="candidature-form__success"
            role="status"
            aria-live="polite"
          >
            <FaCheckCircle aria-hidden="true" />

            <div>
              <h3>Candidature enregistrée</h3>

              <p>
                Merci {values.name.trim()}. Votre candidature a bien été
                enregistrée. Elle n&apos;est pas envoyée par e-mail : notre
                équipe la consulte depuis son espace d&apos;administration
                et vous recontactera.
              </p>
            </div>
          </div>
        ) : (
          <form className="candidature-form__form" onSubmit={handleSubmit}>
            <div className="candidature-form__field">
              <label htmlFor="cand-name">Nom et prénoms *</label>

              <input
                id="cand-name"
                name="name"
                type="text"
                required
                value={values.name}
                onChange={handleChange}
              />
            </div>

            <div className="candidature-form__row">
              <div className="candidature-form__field">
                <label htmlFor="cand-phone">Téléphone</label>

                <input
                  id="cand-phone"
                  name="phone"
                  type="tel"
                  placeholder="+225 07 00 00 00 00"
                  value={values.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="candidature-form__field">
                <label htmlFor="cand-email">E-mail</label>

                <input
                  id="cand-email"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <p className="candidature-form__help">
              Téléphone ou e-mail : au moins l&apos;un des deux est
              nécessaire pour vous recontacter.
            </p>

            <div className="candidature-form__field">
              <label htmlFor="cand-position">Poste souhaité *</label>

              <select
                id="cand-position"
                name="position"
                required
                value={values.position}
                onChange={handleChange}
              >
                <option value="">Choisissez un poste</option>

                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title} — {position.subtitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="candidature-form__field">
              <label htmlFor="cand-skills">Vos compétences</label>

              <textarea
                id="cand-skills"
                name="skills"
                rows={3}
                placeholder="Comptabilité, sonorisation, enseignement, accueil…"
                value={values.skills}
                onChange={handleChange}
              />
            </div>

            <div className="candidature-form__field">
              <label htmlFor="cand-availability">Vos disponibilités</label>

              <input
                id="cand-availability"
                name="availability"
                type="text"
                placeholder="Samedi après-midi, dimanche matin…"
                value={values.availability}
                onChange={handleChange}
              />
            </div>

            <div className="candidature-form__field">
              <label htmlFor="cand-message">Votre motivation</label>

              <textarea
                id="cand-message"
                name="message"
                rows={4}
                value={values.message}
                onChange={handleChange}
              />
            </div>

            <label className="candidature-form__consent">
              <input
                name="consent"
                type="checkbox"
                checked={values.consent}
                onChange={handleChange}
              />

              <span>
                J&apos;accepte d&apos;être contacté(e) par l&apos;église au
                sujet de ma candidature.
              </span>
            </label>

            {error && (
              <p className="candidature-form__error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="candidature-form__submit"
              disabled={isSending}
            >
              {isSending ? "Envoi en cours…" : "Envoyer ma candidature"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
};

export default CandidatureForm;
