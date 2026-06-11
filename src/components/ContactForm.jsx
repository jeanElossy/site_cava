import "./ContactForm.scss";

import {
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";

const ContactForm = () => {
  return (
    <section className="contact-form">
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

          <form>
            <div className="contact-form__row">
              <input
                type="text"
                placeholder="Nom complet *"
                required
              />

              <input
                type="email"
                placeholder="E-mail *"
                required
              />
            </div>

            <input
              type="text"
              placeholder="Sujet *"
              required
            />

            <textarea
              placeholder="Votre message *"
              rows="7"
              required
            ></textarea>

            <label className="contact-form__checkbox">
              <input type="checkbox" />

              <span>
                J'accepte d'être contacté(e) par l'équipe CAVA.
              </span>
            </label>

            <button type="submit">
              Envoyer le message
              <span>➜</span>
            </button>
          </form>

          <small>
            Vos informations sont confidentielles et ne seront jamais
            partagées.
          </small>
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
              <a href="#">
                <FaFacebookF />
              </a>

              <a href="#">
                <FaInstagram />
              </a>

              <a href="#">
                <FaYoutube />
              </a>

              <a href="#">
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