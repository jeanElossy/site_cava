import { useState } from "react";

import { Link } from "react-router-dom";

import {
  Phone,
  Mail,
  MapPin,
  Send,
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";

import logo from "../../assets/logo/logo_cava.gif";

import "./Footer.scss";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Le site est statique : aucun service d'envoi n'est branché. On confirme
  // la saisie localement plutôt que de simuler un appel réseau.
  const handleSubscribe = (event) => {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setIsSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="footer">
      <div className="footer__container">
        {/* À propos */}
        <div className="footer__about">
          <img
            src={logo}
            alt="CAVA"
          />

          <p>
            Le Centre Apostolique Vie et Abondance est une église
            centrée sur Christ, la transformation des vies et
            l’impact de notre génération.
          </p>

          <div className="socials">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>

            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
            >
              <FaYoutube />
            </a>

            <a
              href="https://wa.me/2250712345678"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <FaWhatsapp />
            </a>
          </div>
        </div>

        {/* Liens rapides */}
        <div className="footer__links">
          <h4>LIENS RAPIDES</h4>

          <ul>
            <li>
              <Link to="/">Accueil</Link>
            </li>

            <li>
              <Link to="/about">
                À propos
              </Link>
            </li>

            <li>
              <Link to="/ministries">
                Ministères
              </Link>
            </li>

            <li>
              <Link to="/events">
                Événements
              </Link>
            </li>

            <li>
              <Link to="/media">
                Médias
              </Link>
            </li>

            <li>
              <Link to="/communaute">
                Communauté
              </Link>
            </li>

            <li>
              <Link to="/contact">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="footer__contact">
          <h4>NOUS CONTACTER</h4>

          <div className="contact-item">
            <Phone size={18} />
            <span>+225 07 12 34 56 78</span>
          </div>

          <div className="contact-item">
            <Mail size={18} />
            <span>info@cava.ci</span>
          </div>

          <div className="contact-item">
            <MapPin size={18} />
            <span>Abidjan, Côte d’Ivoire</span>
          </div>
        </div>

        {/* Newsletter */}
        <div className="footer__newsletter">
          <h4>RESTONS CONNECTÉS</h4>

          <p>
            Inscrivez-vous à notre newsletter
            pour recevoir nos actualités.
          </p>

          {isSubscribed ? (
            <p
              className="newsletter__success"
              role="status"
              aria-live="polite"
            >
              Merci ! Votre adresse a bien été enregistrée.
            </p>
          ) : (
            <form
              className="newsletter"
              onSubmit={handleSubscribe}
            >
              <label
                className="sr-only"
                htmlFor="footer-newsletter-email"
              >
                Votre adresse e-mail
              </label>

              <input
                id="footer-newsletter-email"
                type="email"
                placeholder="Votre e-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

              <button
                type="submit"
                aria-label="S'inscrire à la newsletter"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="footer__bottom">
        <span>
          © 2026 Centre Apostolique Vie et Abondance —
          Tous droits réservés.
        </span>

        <div>
          <Link to="/mentions-legales">
            Mentions légales
          </Link>

          <Link to="/politique-confidentialite">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;