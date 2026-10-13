import { useState } from "react";

import {
  FaArrowRight,
  FaCheckCircle,
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";

import { inbox } from "../services/api";

import { site, telHref } from "../content/settings";

import { safeHttpUrl } from "../utils/safeUrl";

import "./ContactForm.scss";

const EMPTY_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
  consent: false,
};

// Coordonnées lues dans les paramètres du site, comme le pied de page.
// Elles étaient recopiées ici en dur, et divergeaient : un autre e-mail
// (« info@cava.ci ») et un autre second numéro que le pied de page.
const phones = [site.phonePrimary, site.phoneSecondary].filter(Boolean);

// Liens sociaux : seuls les liens http(s) sont affichés.
const socials = [
  { icon: FaFacebookF, label: "Facebook", url: site.social.facebook },
  { icon: FaInstagram, label: "Instagram", url: site.social.instagram },
  { icon: FaYoutube, label: "YouTube", url: site.social.youtube },
  { icon: FaWhatsapp, label: "WhatsApp", url: site.social.whatsapp },
]
  .map((social) => ({ ...social, url: safeHttpUrl(social.url) }))
  .filter((social) => social.url);

const ContactForm = () => {
  const [values, setValues] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentName, setSentName] = useState("");

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;

    setValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (error) {
      setError("");
    }
  };

  // Le message part vers `inbox.submit()`, la couture unique avec les
  // données (`services/api.js`). Il est enregistré en base par l'API et
  // consultable depuis /admin/messages ; il n'est PAS envoyé par e-mail,
  // l'expédition automatique n'étant pas branchée. La confirmation
  // affichée ci-dessous le dit explicitement — ne pas l'adoucir.
  //
  // Deux conditions doivent être réunies pour que cet appel aboutisse en
  // production, et l'oubli de l'une des deux le fait échouer sans bruit :
  //   - `connect-src` de la CSP (vercel.json) doit autoriser l'API ;
  //   - `CORS_ORIGIN` côté API doit lister l'origine du site.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSending) {
      return;
    }

    if (!values.consent) {
      setError(
        "Merci d'accepter d'être contacté(e) pour que nous puissions vous répondre."
      );

      return;
    }

    setError("");
    setIsSending(true);

    try {
      await inbox.submit({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        // L'API nomme ce champ `body`, pas `message` : le renommage se
        // fait ici, au point de contact, plutôt que d'aligner l'état du
        // formulaire sur le vocabulaire du serveur.
        body: values.message.trim(),
        // Le consentement est exigé par l'API et vérifié à deux niveaux
        // (service et modèle) : c'est une obligation liée à la politique
        // de confidentialité, il doit être transmis explicitement.
        consent: values.consent === true,
      });

      setSentName(values.name.trim());
      setIsSent(true);
    } catch (caught) {
      setError(
        caught?.message ??
          "Votre message n'a pas pu être enregistré. Merci de réessayer."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setValues(EMPTY_FORM);
    setError("");
    setIsSent(false);
    setSentName("");
  };

  return (
    <section
      className="contact-form"
      id="contact-formulaire"
      aria-label="Écrire à l'église"
    >
      <div className="contact-form__container">
        {/* FORMULAIRE */}
        <div className="contact-form__card contact-form__form">
          <span className="contact-form__eyebrow">Écrivez-nous</span>

          <h2>Envoyez-nous un message</h2>

          <p className="contact-form__intro">
            Que ce soit pour une question, un besoin de prière ou une demande
            d&apos;information, notre équipe vous répondra dans les plus
            brefs délais.
          </p>

          {isSent ? (
            <div
              className="contact-form__success"
              role="status"
              aria-live="polite"
            >
              <FaCheckCircle aria-hidden="true" />

              <h3>Merci {sentName || "à vous"} !</h3>

              <p>
                Votre message a bien été enregistré et sera relevé par notre
                équipe.
              </p>

              {/* Le message est enregistré par l'API — il n'était PAS
                  « conservé dans ce navigateur », comme l'affirmait
                  l'ancienne formulation. Il n'est pas non plus envoyé
                  par e-mail : le dire reste nécessaire. */}
              <p className="contact-form__success-note">
                À noter : nos réponses ne sont pas automatiques, un membre
                de l&apos;équipe relève les messages. Pour une demande
                urgente, appelez-nous directement au {site.phonePrimary}.
              </p>

              <button
                type="button"
                onClick={handleReset}
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <div className="contact-form__row">
                  <div className="contact-form__field">
                    <label htmlFor="contact-name">
                      Nom complet <span aria-hidden="true">*</span>
                    </label>

                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      value={values.name}
                      onChange={handleChange}
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  </div>

                  <div className="contact-form__field">
                    <label htmlFor="contact-email">
                      Adresse e-mail <span aria-hidden="true">*</span>
                    </label>

                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      value={values.email}
                      onChange={handleChange}
                      autoComplete="email"
                      maxLength={160}
                      required
                    />
                  </div>
                </div>

                <div className="contact-form__field">
                  <label htmlFor="contact-subject">
                    Sujet <span aria-hidden="true">*</span>
                  </label>

                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    value={values.subject}
                    onChange={handleChange}
                    maxLength={160}
                    required
                  />
                </div>

                <div className="contact-form__field">
                  <label htmlFor="contact-message">
                    Votre message <span aria-hidden="true">*</span>
                  </label>

                  <textarea
                    id="contact-message"
                    name="message"
                    rows="6"
                    value={values.message}
                    onChange={handleChange}
                    maxLength={5000}
                    required
                  ></textarea>
                </div>

                <label className="contact-form__checkbox">
                  <input
                    type="checkbox"
                    name="consent"
                    checked={values.consent}
                    onChange={handleChange}
                  />

                  <span>
                    J&apos;accepte d&apos;être contacté(e) par l&apos;équipe
                    CAVA.
                  </span>
                </label>

                {error && (
                  <p
                    className="contact-form__error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="contact-form__submit"
                  disabled={isSending}
                  aria-busy={isSending}
                >
                  {isSending ? "Enregistrement…" : "Envoyer le message"}

                  {!isSending && <FaArrowRight aria-hidden="true" />}
                </button>
              </form>

              <small className="contact-form__privacy">
                Vos informations sont confidentielles et ne seront jamais
                partagées.
              </small>
            </>
          )}
        </div>

        {/* COORDONNÉES */}
        <aside
          className="contact-form__card contact-form__info"
          aria-labelledby="contact-info-title"
        >
          <h2 id="contact-info-title">Nos coordonnées</h2>

          <ul className="contact-form__details">
            {phones.length > 0 && (
              <li>
                <span
                  className="contact-form__icon"
                  aria-hidden="true"
                >
                  <FaPhoneAlt />
                </span>

                <div>
                  <h3>Téléphone</h3>

                  {phones.map((phone) => (
                    <a
                      key={phone}
                      href={telHref(phone)}
                    >
                      {phone}
                    </a>
                  ))}

                  <span>Lun - dimanche : 08h00 - 17h00</span>
                </div>
              </li>
            )}

            {site.email && (
              <li>
                <span
                  className="contact-form__icon"
                  aria-hidden="true"
                >
                  <FaEnvelope />
                </span>

                <div>
                  <h3>E-mail</h3>

                  <a href={`mailto:${site.email}`}>{site.email}</a>

                  <span>Nous répondons sous 24h.</span>
                </div>
              </li>
            )}

            <li>
              <span
                className="contact-form__icon"
                aria-hidden="true"
              >
                <FaMapMarkerAlt />
              </span>

              <div>
                <h3>Adresse</h3>

                <p>{site.address.trim()}</p>

                <span>Abidjan, Côte d&apos;Ivoire</span>
              </div>
            </li>
          </ul>

          {socials.length > 0 && (
            <div className="contact-form__social">
              <h3>Réseaux sociaux</h3>

              <ul>
                {socials.map((social) => {
                  const Icon = social.icon;

                  return (
                    <li key={social.label}>
                      <a
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${social.label} (nouvel onglet)`}
                      >
                        <Icon aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default ContactForm;
