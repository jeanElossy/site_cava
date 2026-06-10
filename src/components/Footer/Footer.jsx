import {
  Phone,
  Mail,
  MapPin,
  Send
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp
} from "react-icons/fa";

import logo from "../../assets/logo/logo_cava.gif";

import "./Footer.scss";

const Footer = () => {
  return (
    <footer className="footer">

      <div className="footer__container">

        {/* À propos */}
        <div className="footer__about">

          <img src={logo} alt="CAVA" />

          <p>
            Le Centre Apostolique Vie et Abondance
            est une église centrée sur Christ,
            la transformation des vies et l’impact
            de notre génération.
          </p>

          <div className="socials">

            <a href="/">
              <FaFacebookF />
            </a>

            <a href="/">
              <FaInstagram />
            </a>

            <a href="/">
              <FaYoutube />
            </a>

            <a href="/">
              <FaWhatsapp />
            </a>

          </div>

        </div>

        {/* Liens */}
        <div className="footer__links">

          <h4>LIENS RAPIDES</h4>

          <ul>
            <li>À propos</li>
            <li>Ministères</li>
            <li>Événements</li>
            <li>Médias</li>
            <li>Blog</li>
            <li>Contact</li>
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

          <div className="newsletter">

            <input
              type="email"
              placeholder="Votre e-mail"
            />

            <button type="button">
              <Send size={18} />
            </button>

          </div>

        </div>

      </div>

      <div className="footer__bottom">

        <span>
          © 2025 Centre Apostolique Vie et Abondance —
          Tous droits réservés.
        </span>

        <div>
          <a href="/">Mentions légales</a>
          <a href="/">Politique de confidentialité</a>
        </div>

      </div>

    </footer>
  );
};

export default Footer;