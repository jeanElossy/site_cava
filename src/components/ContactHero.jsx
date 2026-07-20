import { Link } from "react-router-dom";

import "./ContactHero.scss";

import heroImage from "../assets/images/contact-hero.jpg";

const ContactHero = () => {
  return (
    <section className="contact-hero">
      <div className="contact-hero__overlay"></div>

      <img
        src={heroImage}
        alt="Contact CAVA"
        className="contact-hero__bg"
      />

      <div className="contact-hero__content">

        <nav
          className="contact-hero__breadcrumb"
          aria-label="Fil d'Ariane"
        >
          <Link to="/">Accueil</Link>

          <span aria-hidden="true">/</span>

          <span aria-current="page">Contact</span>
        </nav>

        <h1>Contactez-nous</h1>

        <div className="contact-hero__line"></div>

        <p>
          Nous serions heureux de vous entendre et de vous accompagner
          dans votre cheminement avec Christ.
        </p>
      </div>
    </section>
  );
};

export default ContactHero;