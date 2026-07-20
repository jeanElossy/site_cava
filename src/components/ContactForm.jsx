import { useState } from "react";

import "./ContactForm.scss";

import {
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
  FaCheckCircle,
} from "react-icons/fa";

const EMPTY_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
  consent: false,
};

const ContactForm = () => {
  const [values, setValues] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSent, setIsSent] = useState(false);

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

  // Le site est statique : il n'y a aucun backend ni service d'envoi.
  // On confirme donc la saisie localement, sans simuler d'appel réseau.
  const handleSubmit = (event) => {
    event.preventDefault();

    if (!values.consent) {
      setError(
        "Merci d'accepter d'être contacté(e) pour que nous puissions vous répondre."
      );

      return;
    }

    setError("");
    setIsSent(true);
  };

  const handleReset = () => {
    setValues(EMPTY_FORM);
    setError("");
    setIsSent(false);
  };

  return (
    <section className="contact-form" id="contact-formulaire">
      <div className="contact-form__container">
        {/* FORMULAIRE */}
        <div className="contact-form__card contact-form__form">
          <h2>Envoyez-nous un message</h2>

          <div className="contact-form__title-line"></div>

          <p>
            Que ce soit pour une question, un besoin de prière ou une demande
            d'information, notre équipe vous répondra dans les plus brefs
            délais.
          </p>

          {isSent ? (
            <div
              className="contact-form__success"
              role="status"
              aria-live="polite"
            >
              <FaCheckCircle aria-hidden="true" />

              <h3>Merci {values.name.trim() || "à vous"} !</h3>

              <p>
                Votre message a bien été enregistré. Notre équipe vous
                répondra dans les plus brefs délais. Pour une demande
                urgente, vous pouvez nous appeler directement.
              </p>

              <button type="button" onClick={handleReset}>
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} noValidate={false}>
                <div className="contact-form__row">
                  <div className="contact-form__field">
                    <label
                      className="sr-only"
                      htmlFor="contact-name"
                    >
                      Nom complet
                    </label>

                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      placeholder="Nom complet *"
                      value={values.name}
                      onChange={handleChange}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="contact-form__field">
                    <label
                      className="sr-only"
                      htmlFor="contact-email"
                    >
                      Adresse e-mail
                    </label>

                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      placeholder="E-mail *"
                      value={values.email}
                      onChange={handleChange}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="contact-form__field">
                  <label
                    className="sr-only"
                    htmlFor="contact-subject"
                  >
                    Sujet
                  </label>

                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    placeholder="Sujet *"
                    value={values.subject}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="contact-form__field">
                  <label
                    className="sr-only"
                    htmlFor="contact-message"
                  >
                    Votre message
                  </label>

                  <textarea
                    id="contact-message"
                    name="message"
                    placeholder="Votre message *"
                    rows="7"
                    value={values.message}
                    onChange={handleChange}
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
                    J'accepte d'être contacté(e) par l'équipe CAVA.
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

                <button type="submit">
                  Envoyer le message
                  <span aria-hidden="true">➜</span>
                </button>
              </form>

              <small>
                Vos informations sont confidentielles et ne seront jamais
                partagées.
              </small>
            </>
          )}
        </div>

        {/* COORDONNÉES */}
        <div className="contact-form__card contact-form__info">
          <h2>Nos coordonnées</h2>

          <div className="contact-form__title-line"></div>

          <div className="contact-info">
            <div className="contact-info__icon">
              <FaPhoneAlt />
            </div>

            <div>
              <h4>Téléphone</h4>

              <p>+225 07 88 06 15 84</p>
              <p>+225 27 22 23 71 97</p>

              <span>Lun - dimanche : 08h00 - 17h00</span>
            </div>
          </div>

          <div className="contact-info">
            <div className="contact-info__icon">
              <FaEnvelope />
            </div>

            <div>
              <h4>E-mail</h4>

              <p>info@cava.ci</p>

              <span>Nous répondons sous 24h.</span>
            </div>
          </div>

          <div className="contact-info">
            <div className="contact-info__icon">
              <FaMapMarkerAlt />
            </div>

            <div>
              <h4>Adresse</h4>

              <p>
                CAVA – Centre Apostolique Vie et Abondance
              </p>

              <span>
                Abidjan, Côte d'Ivoire
                <br />
                Quartier Angré chateau, non loin de l'institut des jesuites
              </span>
            </div>
          </div>

          <div className="contact-social">
            <h4>Réseaux sociaux</h4>

            <div className="contact-social__icons">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <FaFacebookF />
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
              >
                <FaInstagram />
              </a>

              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
              >
                <FaYoutube />
              </a>

              <a
                href="https://wa.me/2250712345678"
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
              >
                <FaWhatsapp />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;