import { Link } from "react-router-dom";

import {
  FaChurch,
  FaHammer,
  FaHandHoldingHeart,
  FaGlobeAfrica,
  FaPrayingHands,
  FaHeart,
} from "react-icons/fa";

import useAsyncData from "../../../hooks/useAsyncData";
import { fetchDonationTypes } from "../../../services/donations";

import "./ContributionTypes.scss";

// Raccourcis vers le tunnel de don, un par TYPE DE DON RÉEL.
//
// ------------------------------------------------------------------
// POURQUOI LA LISTE VIENT DE L'API
// ------------------------------------------------------------------
// Ces cartes portaient une liste écrite en dur (« Dîme », « Don »,
// « Projet spécial »…) et sélectionnaient un type dans un état qui
// n'existe plus. Deux problèmes : le clic ne faisait plus rien, et
// les libellés ne correspondaient plus à ceux que l'administration
// gère réellement (DonationType).
//
// La liste est donc celle de l'API, la même que le sélecteur de
// l'étape 1 du tunnel. Chaque carte est un LIEN vers
// `/donate?type=<nom>#contribution-form` : exactement l'URL que
// produit le QR code projeté pendant un culte
// (GET /admin/donations/qrcode), donc un seul mécanisme de
// préremplissage à maintenir — celui de `StepIdentity`.
const ICONS = {
  "dîme": <FaChurch />,
  "dime": <FaChurch />,
  offrande: <FaPrayingHands />,
  "action de grâce": <FaHandHoldingHeart />,
  "action de grace": <FaHandHoldingHeart />,
  construction: <FaHammer />,
  mission: <FaGlobeAfrica />,
};

const iconFor = (name) =>
  ICONS[String(name ?? "").trim().toLowerCase()] ?? <FaHeart />;

const ContributionTypes = () => {
  const { data: types, loading, error } = useAsyncData(fetchDonationTypes);

  // Le tunnel est sur la même page : le lien met le `?type=` dans
  // l'URL (c'est lui que lit `StepIdentity`) et le défilement amène
  // le visiteur au formulaire. React Router ne fait rien du `#` tout
  // seul, d'où le `scrollIntoView` explicite.
  const scrollToForm = () => {
    document
      .getElementById("contribution-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="contribution-types" id="types">
      <div className="contribution-types__container">

        <header className="contribution-types__header">
          <span className="donate-eyebrow">Première étape</span>

          <h2>Choisissez votre contribution</h2>

          <p>
            Chaque forme de contribution a son sens. Choisissez celle
            qui correspond à votre démarche : le formulaire s&apos;ouvre
            avec ce type déjà sélectionné.
          </p>
        </header>

        {loading && (
          <p className="contribution-types__hint">
            Chargement des types de don…
          </p>
        )}

        {error && (
          <p className="contribution-types__hint contribution-types__hint--error">
            {error}
          </p>
        )}

        {types && types.length === 0 && (
          <p className="contribution-types__hint">
            Aucun type de don n&apos;est proposé pour le moment.
          </p>
        )}

        {types && types.length > 0 && (
          <div className="contribution-types__grid">
            {types.map((type) => (
              <Link
                key={type.id}
                to={`/donate?type=${encodeURIComponent(type.name)}#contribution-form`}
                className="contribution-types__card"
                onClick={scrollToForm}
              >
                <span
                  className="contribution-types__icon"
                  aria-hidden="true"
                >
                  {iconFor(type.name)}
                </span>

                <span className="contribution-types__title">
                  {type.name}
                </span>

                {type.description && (
                  <span className="contribution-types__desc">
                    {type.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};

export default ContributionTypes;
