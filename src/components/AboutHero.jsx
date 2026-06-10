import "./AboutHero.scss";

import heroImage from "../assets/images/about-hero.jpg.png";

const AboutHero = () => {
  return (
    <section
      className="about-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div className="about-hero__overlay"></div>

      <div className="about-hero__container">
        <div className="about-hero__content">

          <h1>
            Une église centrée sur Christ,
            <br />
            pour transformer des vies et
            <br />
            impacter notre génération.
          </h1>

          <div className="about-hero__line"></div>

          <p>
            Le Centre Apostolique Vie et Abondance est une église
            passionnée par la présence de Dieu et par l'amour
            authentique manifesté en Jésus-Christ.
          </p>

        </div>
      </div>
    </section>
  );
};

export default AboutHero;