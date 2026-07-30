import heroImage from "../../../assets/images/family.jpg";

import "./RegistrationHero.scss";

// Même mécanique que les héros d'intérieur du site (AboutHero,
// EventsHero…) : pleine section, image de fond, dégradé vert à
// gauche. Le seul élément propre à cette page est le petit badge
// matricule, qui ancre le héros dans le sujet concret (l'identité
// numérotée de chaque membre) plutôt que d'être une bannière
// interchangeable avec n'importe quelle autre page.
const RegistrationHero = () => {
  return (
    <section
      className="registration-hero"
      style={{
        backgroundImage: `url(${heroImage})`,
      }}
    >
      <div className="registration-hero__overlay"></div>

      <div className="registration-hero__container">
        <div className="registration-hero__content">
          <span className="registration-hero__tag">
            REJOIGNEZ LA FAMILLE CAVA
          </span>

          <h1>
            Devenir membre du Centre
            <br />
            Apostolique Vie et Abondance
          </h1>

          <div className="registration-hero__line"></div>

          <p>
            Que vous rejoigniez la famille CAVA pour la première fois
            ou que vous possédiez déjà un matricule, cette page vous
            permet de déclarer ou de mettre à jour vos informations.
            Une équipe vérifie chaque demande avant son enregistrement
            définitif.
          </p>

          <div
            className="registration-hero__badge"
            aria-hidden="true"
          >
            <span className="registration-hero__badge-label">
              Votre identité dans l&apos;église
            </span>

            {/* Forme du matricule, pas un exemple réel : un vrai
                numéro pourrait coïncider avec celui d'un membre
                existant et prêter à confusion. */}
            <span className="registration-hero__badge-code">
              XXX XX-XXX X
            </span>

            <span className="registration-hero__badge-caption">
              Un matricule unique, attribué à la validation de votre
              inscription
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RegistrationHero;
