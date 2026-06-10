import "./DonationHero.scss";

import heroImage from "../assets/images/donation-hero.jpg";

const DonationHero = () => {
  return (
    <section
      className="donation-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div className="donation-hero__overlay" />

      <div className="donation-hero__container">

        <div className="donation-hero__content">

          <h1>
            Faites un don,
            <br />
            semez l'espoir
          </h1>

          <div className="donation-hero__line" />

          <p>
            Votre générosité nous permet de transformer
            des vies et d'accomplir la mission que Dieu
            nous a confiée.
          </p>

        </div>

      </div>
    </section>
  );
};

export default DonationHero;