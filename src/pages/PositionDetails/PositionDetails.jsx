import { createElement, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FaCheckCircle, FaClock, FaUsers } from "react-icons/fa";
import { HiArrowLeft, HiArrowRight } from "react-icons/hi";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";
import { positions as positionsApi } from "../../services/api";
import { iconFor, variantFor } from "../../components/candidature/positionIcons";
import { useReveal } from "../../components/candidature/motion";

import "./PositionDetails.scss";

const PositionDetails = () => {
  const { slug } = useParams();
  const reveal = useReveal();

  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState("loading");

  // Pas de `setStatus("loading")` ici : l'effet ne pose plus d'état de
  // façon synchrone, ce qui déclencherait un rendu en cascade. L'état
  // initial vaut déjà « loading », et la route remonte le composant à
  // chaque slug (`key={slug}` dans AppRoutes) — passer d'un poste à
  // l'autre repart donc bien de zéro.
  useEffect(() => {
    let alive = true;

    positionsApi
      .getPublic(slug)
      .then((data) => {
        if (!alive) return;

        setPosition(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive) return;

        // Un poste archivé ou un slug inventé donnent la même réponse
        // — ils sont introuvables publiquement, et c'est bien le même
        // message qu'il faut afficher.
        setStatus("missing");
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  // Le titre de l'onglet suit la ressource chargée. Tant qu'elle n'est
  // pas là, un libellé générique vaut mieux qu'un titre vide.
  usePageMeta({
    title: position?.title
      ? `${position.title} — Appel à candidatures`
      : "Poste — Appel à candidatures",
    description:
      position?.intro?.slice(0, 160) ??
      "Découvrez ce poste ouvert au sein du Centre Apostolique Vie et Abondance et candidatez en ligne.",
  });

  // Minuscule, et rendu par `createElement` : une variable capitalisée
  // au premier niveau du composant se lit comme la DÉCLARATION d'un
  // composant, que React recréerait à chaque rendu.
  const icon = iconFor(position?.icon);

  return (
    <>
      <Navbar />

      <main className="position-details">
        {status === "loading" && (
          <p className="position-details__state" role="status">
            Chargement du poste…
          </p>
        )}

        {status === "missing" && (
          <div className="position-details__state">
            <h1>Poste introuvable</h1>

            <p>
              Ce poste n&apos;existe pas ou n&apos;est plus ouvert aux
              candidatures.
            </p>

            <Link
              className="position-details__back"
              to="/appel-a-candidature"
            >
              <HiArrowLeft aria-hidden="true" />
              Revenir aux postes ouverts
            </Link>
          </div>
        )}

        {status === "ready" && position && (
          <>
            <header
              className={`position-details__hero position-details__hero--${variantFor(
                position.variant
              )}`}
            >
              <div className="position-details__container">
                <Link
                  className="position-details__back"
                  to="/appel-a-candidature"
                >
                  <HiArrowLeft aria-hidden="true" />
                  Tous les postes ouverts
                </Link>

                <span className="position-details__icon" aria-hidden="true">
                  {createElement(icon)}
                </span>

                <h1 className="position-details__title">{position.title}</h1>

                {position.subtitle && (
                  <p className="position-details__subtitle">
                    {position.subtitle}
                  </p>
                )}

                {position.intro && (
                  <p className="position-details__intro">{position.intro}</p>
                )}

                <ul className="position-details__facts">
                  {position.openings && (
                    <li>
                      <FaUsers aria-hidden="true" />
                      <span>
                        <strong>Places</strong>
                        {position.openings}
                      </span>
                    </li>
                  )}

                  {position.commitment && (
                    <li>
                      <FaClock aria-hidden="true" />
                      <span>
                        <strong>Engagement</strong>
                        {position.commitment}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </header>

            <div className="position-details__container position-details__body">
              {position.missions?.length > 0 && (
                <motion.section
                  className="position-details__panel"
                  {...reveal(0, "x")}
                >
                  <h2>Vos missions</h2>

                  <ul className="position-details__list">
                    {position.missions.map((item) => (
                      <li key={item.value}>
                        <FaCheckCircle aria-hidden="true" />
                        {item.value}
                      </li>
                    ))}
                  </ul>
                </motion.section>
              )}

              {position.requirements?.length > 0 && (
                <motion.section
                  className="position-details__panel position-details__panel--gold"
                  {...reveal(1)}
                >
                  <h2>Profil recherché</h2>

                  <ul className="position-details__list">
                    {position.requirements.map((item) => (
                      <li key={item.value}>
                        <FaCheckCircle aria-hidden="true" />
                        {item.value}
                      </li>
                    ))}
                  </ul>
                </motion.section>
              )}
            </div>

            <div className="position-details__container">
              <motion.div className="position-details__cta" {...reveal(2)}>
                {/* Espaces insécables autour des guillemets français :
                    sans eux, le guillemet fermant se retrouve seul en
                    début de ligne au premier retour à la ligne. */}
                <p>
                  Ce poste vous correspond ? Répondez au questionnaire
                  {"\u00a0«\u00a0Découvre ta place\u00a0»\u00a0"}— il
                  arrivera prérempli avec ce poste.
                </p>

                {/* Le poste voyage dans l'URL, comme partout ailleurs
                    sur cette page et comme le type de don sur /donate :
                    un seul mécanisme de préremplissage à maintenir. */}
                <Link
                  to={`/appel-a-candidature?poste=${position.slug}#candidature-formulaire`}
                >
                  Je candidate à ce poste
                  <HiArrowRight aria-hidden="true" />
                </Link>
              </motion.div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </>
  );
};

export default PositionDetails;
