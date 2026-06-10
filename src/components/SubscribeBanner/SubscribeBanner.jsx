import { ArrowRight } from "lucide-react";
import "./SubscribeBanner.scss";

import {
  FaYoutube,
  FaFacebookF,
  FaInstagram
} from "react-icons/fa";

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

        <button>
          S'abonner
          <ArrowRight size={18} />
        </button>

        <div className="subscribe-banner__socials">
          <FaYoutube />
          <FaFacebookF />
          <FaInstagram />
        </div>

      </div>

    </section>
  );
};

export default SubscribeBanner;