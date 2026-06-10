import heroImg from "../../assets/images/media-hero.jpg";

import "./MediaHero.scss";

const MediaHero = () => {
  return (
    <section
      className="media-hero"
      style={{
        backgroundImage: `url(${heroImg})`
      }}
    >
      <div className="media-hero__overlay" />

      <div className="media-hero__container">

        <div className="media-hero__content">

          <h1>Médias</h1>

          <div className="media-hero__line" />

          <p>
            Retrouvez nos messages,
            louanges et contenus édifiants
            pour nourrir votre foi au quotidien.
          </p>

        </div>

      </div>

    </section>
  );
};

export default MediaHero;