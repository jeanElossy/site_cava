import { ArrowRight } from "lucide-react";
import "./SubscribeBanner.scss";

import {
  FaYoutube,
  FaFacebookF,
  FaInstagram
} from "react-icons/fa";

// Mêmes destinations que les liens sociaux du pied de page.
// (Navigation externe : la CSP restreint le chargement de ressources,
// pas les liens sortants.)
const socials = [
  {
    icon: <FaYoutube />,
    label: "YouTube",
    url: "https://youtube.com",
  },
  {
    icon: <FaFacebookF />,
    label: "Facebook",
    url: "https://facebook.com",
  },
  {
    icon: <FaInstagram />,
    label: "Instagram",
    url: "https://instagram.com",
  },
];

const SubscribeBanner = () => {
  return (
    <section className="subscribe-banner">

      <div className="subscribe-banner__content">

        <div>

          <h2>Ne manquez rien</h2>

          <p>
            Abonnez-vous à notre chaîne YouTube
            et suivez-nous sur nos réseaux sociaux.
          </p>

        </div>

        <a
          className="subscribe-banner__cta"
          href="https://youtube.com"
          target="_blank"
          rel="noreferrer"
        >
          S'abonner
          <ArrowRight size={18} aria-hidden="true" />
        </a>

        <div className="subscribe-banner__socials">
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.url}
              target="_blank"
              rel="noreferrer"
              aria-label={social.label}
            >
              {social.icon}
            </a>
          ))}
        </div>

      </div>

    </section>
  );
};

export default SubscribeBanner;
