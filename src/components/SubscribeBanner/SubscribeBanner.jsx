import { ArrowRight } from "lucide-react";

import {
  FaYoutube,
  FaFacebookF,
  FaInstagram,
} from "react-icons/fa";

import { site } from "../../content/settings";

import { safeHttpUrl } from "../../utils/safeUrl";

import "./SubscribeBanner.scss";

// Mêmes destinations que le pied de page : les paramètres du site. Elles
// étaient recopiées ici en dur. Un lien non conforme (autre chose que
// http/https) n'est pas affiché.
const socials = [
  { icon: FaYoutube, label: "YouTube", url: site.social.youtube },
  { icon: FaFacebookF, label: "Facebook", url: site.social.facebook },
  { icon: FaInstagram, label: "Instagram", url: site.social.instagram },
]
  .map((social) => ({ ...social, url: safeHttpUrl(social.url) }))
  .filter((social) => social.url);

const youtube = socials.find((social) => social.label === "YouTube");

const SubscribeBanner = () => {
  return (
    <section
      className="subscribe-banner"
      aria-labelledby="subscribe-banner-title"
    >
      <div className="subscribe-banner__content">
        <div className="subscribe-banner__text">
          <h2 id="subscribe-banner-title">Ne manquez rien</h2>

          <p>
            Abonnez-vous à notre chaîne YouTube et suivez-nous sur nos
            réseaux sociaux.
          </p>
        </div>

        <div className="subscribe-banner__actions">
          {youtube && (
            <a
              className="subscribe-banner__cta"
              href={youtube.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              S&apos;abonner
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          )}

          <ul className="subscribe-banner__socials">
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
      </div>
    </section>
  );
};

export default SubscribeBanner;
