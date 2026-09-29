import heroImage from "../../../assets/images/family.jpg";

import "./CandidatureHero.scss";

const CandidatureHero = () => (
  <section
    className="candidature-hero"
    style={{ backgroundImage: `url(${heroImage})` }}
  >
    <div className="candidature-hero__overlay" aria-hidden="true" />

    <div className="candidature-hero__container">
      <div className="candidature-hero__content">
        {/* Unique h1 de la page : le fil des titres descend ensuite en
            h2 par section (voir usePageMeta dans la page). */}
        <h1 className="candidature-hero__title">
          Appel à <span>candidatures</span>
        </h1>

        <p className="candidature-hero__baseline">
          ÇA.VA. se structure.
          <br />
          Et si vous preniez votre place
        </p>

        <p className="candidature-hero__claim">
          pour <span>servir ?</span>
        </p>

        <div className="candidature-hero__rule" aria-hidden="true" />

        <p className="candidature-hero__intro">
          Dans le cadre de la constitution et du renforcement de ses
          structures, ÇA.VA. recherche des hommes et des femmes disposés à
          mettre leurs dons, leurs compétences et leur disponibilité au
          service de la vision.
        </p>
      </div>

      <p className="candidature-hero__badge">
        Des serviteurs pour une Église qui impacte !
      </p>

      {/* Décoratif : quatre mots d'ambiance de la maquette. `aria-hidden`
          parce qu'ils n'apportent rien à qui écoute la page — le sens est
          déjà porté par le paragraphe d'introduction ci-dessus. */}
      <ul className="candidature-hero__keywords" aria-hidden="true">
        <li>Vision</li>
        <li>Service</li>
        <li>Unité</li>
        <li>Impact</li>
      </ul>
    </div>
  </section>
);

export default CandidatureHero;
