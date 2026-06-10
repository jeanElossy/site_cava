import "./MinistriesHero.scss";

import heroImage from "../assets/images/ministries-hero.jpg";

const MinistriesHero = () => {
  return (
    <section
      className="ministries-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div className="ministries-hero__overlay"></div>

      <div className="ministries-hero__container">

        <div className="ministries-hero__content">

          <h1>Nos ministères</h1>

          <h2>
            Des ministères pour bâtir des vies
            <br />
            et accomplir la mission de Dieu.
          </h2>

          <div className="ministries-hero__line"></div>

          <blockquote>
            « Que chacun mette au service des autres le don qu'il a reçu,
            comme de bons gestionnaires de la grâce de Dieu. »
          </blockquote>

          <p>1 Pierre 4:10</p>

        </div>

      </div>
    </section>
  );
};

export default MinistriesHero;