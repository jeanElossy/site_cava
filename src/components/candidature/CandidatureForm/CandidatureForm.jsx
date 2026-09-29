import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaPrayingHands } from "react-icons/fa";

import { inbox } from "../../../services/api";
import {
  normalizeRegistrationNumber,
  formatRegistrationNumber,
  hasValidShape,
} from "../../../utils/registrationNumber";
import positions, { findPosition } from "../data/positions";
import { useReveal } from "../motion";
import {
  SKILLS,
  SITUATIONS,
  AVAILABILITIES,
  PRAYER,
} from "./questionnaire";

import "./CandidatureForm.scss";

const EMPTY_FORM = {
  name: "",
  registrationNumber: "",
  phone: "",
  email: "",
  position: "",
  skills: [],
  otherSkill: "",
  concern: "",
  contribution: "",
  situation: [],
  availability: [],
  orientation: "oui",
  consent: false,
};

const listOrDash = (values, extra = "") => {
  const all = extra.trim() ? [...values, `Autre : ${extra.trim()}`] : values;

  return all.length > 0 ? all.map((item) => `- ${item}`).join("\n") : "- —";
};

// Le corps du message est assemblé en texte lisible : la boîte de
// réception (/admin/messages) affiche un message, pas un formulaire
// structuré. Mieux vaut une fiche qui se lit d'un coup d'œil qu'un JSON
// que personne ne relira. Les titres reprennent ceux du questionnaire
// papier, pour que les deux se dépouillent côte à côte.
const buildBody = (values) => {
  const canonical = normalizeRegistrationNumber(values.registrationNumber);

  return [
    `Poste souhaité : ${
      findPosition(values.position)?.title ?? "Non précisé"
    }`,
    `Matricule : ${
      hasValidShape(canonical)
        ? formatRegistrationNumber(canonical)
        : values.registrationNumber.trim() || "—"
    }`,
    `Téléphone : ${values.phone.trim() || "—"}`,
    `E-mail : ${values.email.trim() || "—"}`,
    "",
    "1. CE QUE JE SAIS FAIRE",
    listOrDash(values.skills, values.otherSkill),
    "",
    "2. CE QUI ME TOUCHE PARTICULIÈREMENT",
    values.concern.trim() || "—",
    "",
    "3. CE QUE JE POURRAIS APPORTER",
    values.contribution.trim() || "—",
    "",
    "4. JE SUIS ACTUELLEMENT…",
    listOrDash(values.situation),
    "",
    "5. MA DISPONIBILITÉ",
    listOrDash(values.availability),
    "",
    `Souhaite être contacté(e) pour une orientation : ${
      values.orientation === "oui" ? "Oui" : "Non"
    }`,
  ].join("\n");
};

const CandidatureForm = () => {
  const [searchParams] = useSearchParams();
  const reveal = useReveal();

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

  const clearError = () => error && setError("");

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    clearError();
  };

  // Cases à cocher multiples : l'état porte un tableau de libellés.
  const toggleInGroup = (group, label) => {
    setValues((previous) => ({
      ...previous,
      [group]: previous[group].includes(label)
        ? previous[group].filter((item) => item !== label)
        : [...previous[group], label],
    }));

    clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSending) return;

    // Au moins un moyen de rappel. Beaucoup de fidèles n'ont pas
    // d'adresse e-mail : exiger l'e-mail aurait écarté précisément les
    // personnes recherchées. L'API applique la même règle.
    if (!values.phone.trim() && !values.email.trim()) {
      setError(
        "Indiquez au moins un téléphone ou un e-mail pour que nous puissions vous recontacter."
      );

      return;
    }

    if (!values.consent) {
      setError(
        "Merci d'accepter d'être contacté(e) pour que votre réponse soit étudiée."
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
        // que les champs définis, et une clé absente vaut mieux qu'un
        // e-mail vide écrit en base.
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        subject: `Découvre ta place — ${
          findPosition(values.position)?.title ?? "Sans poste précisé"
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
          "Votre réponse n'a pas pu être enregistrée. Merci de réessayer."
      );
    } finally {
      setIsSending(false);
    }
  };

  const checkboxGroup = (group, options) => (
    <div className="candidature-form__choices">
      {options.map((label) => (
        <label key={label} className="candidature-form__choice">
          <input
            type="checkbox"
            checked={values[group].includes(label)}
            onChange={() => toggleInGroup(group, label)}
          />

          <span>{label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <section className="candidature-form" id="candidature-formulaire">
      <div className="candidature-form__container">
        <motion.h2 className="candidature-form__title" {...reveal()}>
          Découvre <span>ta place</span>
        </motion.h2>

        <motion.p className="candidature-form__question" {...reveal(1)}>
          « Qu&apos;y a-t-il en toi pour la maison ? »
        </motion.p>

        <motion.p className="candidature-form__verse" {...reveal(2)}>
          « Que chacun de vous mette au service des autres le don qu&apos;il
          a reçu. » — 1 Pierre 4.10
        </motion.p>

        {isSent ? (
          <motion.div
            className="candidature-form__success"
            role="status"
            aria-live="polite"
            {...reveal()}
          >
            <FaCheckCircle aria-hidden="true" />

            <div>
              <h3>Réponse enregistrée</h3>

              <p>
                Merci {values.name.trim()}. Votre réponse a bien été
                enregistrée. Elle n&apos;est pas envoyée par e-mail : notre
                équipe la consulte depuis son espace d&apos;administration
                et vous recontactera.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            className="candidature-form__form"
            onSubmit={handleSubmit}
            {...reveal(3, "y", "some")}
          >
            {/* BANDE 1 — coordonnées, toutes sur une seule ligne en
                grand écran (voir `&__row` dans le SCSS). */}
            <div className="candidature-form__row candidature-form__row--identity">
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

              <div className="candidature-form__field">
                <label htmlFor="cand-matricule">Matricule</label>

                <input
                  id="cand-matricule"
                  name="registrationNumber"
                  type="text"
                  placeholder="1ME 19-016 P"
                  value={values.registrationNumber}
                  onChange={handleChange}
                />
              </div>

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

              <div className="candidature-form__field">
                <label htmlFor="cand-position">Poste souhaité</label>

                <select
                  id="cand-position"
                  name="position"
                  value={values.position}
                  onChange={handleChange}
                >
                  <option value="">Je ne sais pas encore</option>

                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.title} — {position.subtitle}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="candidature-form__help candidature-form__help--tight">
              Téléphone ou e-mail : au moins l&apos;un des deux est
              nécessaire pour vous recontacter.
            </p>

            {/* `fieldset`/`legend` et non un simple titre : c'est ce qui
                annonce le groupe aux lecteurs d'écran avant d'énumérer
                les cases, sans quoi chaque case arrive hors contexte. */}
            {/* BANDE 2 — deux colonnes : la liste des savoir-faire, la
                plus longue, occupe la colonne large ; situation et
                disponibilité s'empilent dans la colonne étroite, ce qui
                équilibre les deux hauteurs. */}
            <div className="candidature-form__band candidature-form__band--skills">
              <fieldset className="candidature-form__group">
                <legend>1. Ce que je sais faire</legend>

              <p className="candidature-form__help">
                Cochez ce qui vous correspond.
              </p>

              {checkboxGroup("skills", SKILLS)}

                <div className="candidature-form__field">
                  <label htmlFor="cand-other-skill">Autre</label>

                  <input
                    id="cand-other-skill"
                    name="otherSkill"
                    type="text"
                    value={values.otherSkill}
                    onChange={handleChange}
                  />
                </div>
              </fieldset>

              <div className="candidature-form__stack">
                <fieldset className="candidature-form__group">
                  <legend>4. Je suis actuellement…</legend>

                  {checkboxGroup("situation", SITUATIONS)}
                </fieldset>

                <fieldset className="candidature-form__group">
                  <legend>5. Ma disponibilité</legend>

                  {checkboxGroup("availability", AVAILABILITIES)}
                </fieldset>
              </div>
            </div>

            {/* BANDE 3 — les deux questions ouvertes côte à côte : même
                nature, même hauteur de zone de saisie. */}
            <div className="candidature-form__band candidature-form__band--open">
              <div className="candidature-form__field">
                <label htmlFor="cand-concern">
                  2. Ce qui me touche particulièrement
                </label>

                <p className="candidature-form__help">
                  Quand je regarde la vie de l&apos;Église, quel besoin me
                  touche ou m&apos;interpelle le plus ?
                </p>

                <textarea
                  id="cand-concern"
                  name="concern"
                  rows={5}
                  value={values.concern}
                  onChange={handleChange}
                />
              </div>

              <div className="candidature-form__field">
                <label htmlFor="cand-contribution">
                  3. Ce que je pourrais apporter
                </label>

                <p className="candidature-form__help">
                  Une compétence, une expérience, un talent, une ressource
                  ou une disponibilité que je pourrais mettre au service de
                  la maison.
                </p>

                <textarea
                  id="cand-contribution"
                  name="contribution"
                  rows={5}
                  value={values.contribution}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* BANDE 4 — la prière tient la colonne de gauche, le
                dernier choix et l'envoi celle de droite : la page se
                termine sur le bouton, pas sur un texte. */}
            <div className="candidature-form__band candidature-form__band--closing">
              <blockquote className="candidature-form__prayer">
                <FaPrayingHands aria-hidden="true" />

                <div>
                  <p className="candidature-form__prayer-title">Ma prière</p>

                  <p>« {PRAYER} »</p>
                </div>
              </blockquote>

              <div className="candidature-form__stack">
                <fieldset className="candidature-form__group">
                  <legend>
                    Je souhaite être contacté(e) pour une orientation
                  </legend>

              {/* Des boutons radio : les deux réponses s'excluent, et une
                  case à cocher « Oui » laisserait le « Non » implicite,
                  donc indistinguable d'une absence de réponse. */}
              <div className="candidature-form__choices candidature-form__choices--inline">
                {[
                  { value: "oui", label: "Oui" },
                  { value: "non", label: "Non" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="candidature-form__choice"
                  >
                    <input
                      type="radio"
                      name="orientation"
                      value={option.value}
                      checked={values.orientation === option.value}
                      onChange={handleChange}
                    />

                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
                </fieldset>

                <label className="candidature-form__consent">
                  <input
                    name="consent"
                    type="checkbox"
                    checked={values.consent}
                    onChange={handleChange}
                  />

                  <span>
                    J&apos;accepte que ma réponse soit enregistrée et que
                    l&apos;église me recontacte à ce sujet.
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
                  {isSending ? "Envoi en cours…" : "Envoyer ma réponse"}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </div>
    </section>
  );
};

export default CandidatureForm;
