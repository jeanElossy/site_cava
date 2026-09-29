import { Link } from "react-router-dom";

import {
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";

import logo from "../../assets/logo/logo_cava.gif";

import NewsletterForm from "../NewsletterForm";

import { site, telHref } from "../../content/settings";

import "./Footer.scss";

const Footer = () => {
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
              href={site.social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>

            <a
              href={site.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href={site.social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
            >
              <FaYoutube />
            </a>

            <a
              href={site.social.whatsapp}
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

          {/* Coordonnées issues des Paramètres de l'administration.
              Voir src/content/settings.js : tant qu'un champ n'y est
              pas renseigné, la valeur affichée jusqu'ici est conservée,
              pour ne pas vider le pied de page. */}
          <div className="contact-item">
            <Phone size={18} />
            <a href={telHref(site.phonePrimary)}>
              {site.phonePrimary}
            </a>
          </div>

          {site.phoneSecondary && (
            <div className="contact-item">
              <Phone size={18} />
              <a href={telHref(site.phoneSecondary)}>
                {site.phoneSecondary}
              </a>
            </div>
          )}

          <div className="contact-item">
            <Mail size={18} />
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </div>

          <div className="contact-item">
            <MapPin size={18} />
            <span>{site.address}</span>
          </div>
        </div>

        {/* Newsletter */}
        <div className="footer__newsletter">
          <h4>RESTONS CONNECTÉS</h4>

          <p>
            Inscrivez-vous à notre newsletter
            pour recevoir nos actualités.
          </p>

          <NewsletterForm
            variant="dark"
            compact
          />

        </div>
      </div>

      <div className="footer__bottom">
        <span>
          © {new Date().getFullYear()} {site.churchName} —
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