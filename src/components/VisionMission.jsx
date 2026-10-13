import { motion } from "framer-motion";

import "./VisionMission.scss";

import bibleImage from "../assets/images/bible.jpg";

// Les six verbes de la mission, dans l'ordre du texte officiel ci-dessous :
// ils en sont un résumé visuel, pas une formulation nouvelle.
const missionSteps = [
  { id: "annoncer", verb: "Annoncer", text: "fidèlement l'Évangile de Jésus-Christ" },
  { id: "conduire", verb: "Conduire", text: "à une relation vivante avec Lui" },
  { id: "accompagner", verb: "Accompagner", text: "dans la croissance spirituelle" },
  { id: "former", verb: "Former", text: "des disciples" },
  { id: "equiper", verb: "Équiper", text: "pour le service" },
  { id: "envoyer", verb: "Envoyer", text: "manifester la vie abondante de Dieu" },
];

const VisionMission = () => {
  return (
    <section
      className="vision-mission"
      id="vision"
      aria-labelledby="vision-mission-title"
    >
      <div className="vision-mission__container">
        <motion.div
          className="vision-mission__media"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <img
            src={bibleImage}
            alt="Une Bible ouverte devant une assemblée en prière"
            loading="lazy"
            decoding="async"
          />

          <div className="vision-mission__vision">
            <span className="vision-mission__label">Notre vision</span>

            <p>
              Communiquer la vie abondante de Dieu en Jésus-Christ par la
              Parole et le Saint-Esprit à travers une Église spirituelle,
              organisée, structurée et impactante afin de bâtir un peuple
              qui révèle Dieu.
            </p>
          </div>
        </motion.div>

        <div className="vision-mission__body">
          <span className="vision-mission__eyebrow">Qui sommes-nous</span>

          <h2 id="vision-mission-title">Notre mission</h2>

          <p className="vision-mission__text">
            Le Centre Apostolique Vie et Abondance (ÇA.VA.) a pour mission
            d&apos;annoncer fidèlement l&apos;Évangile de Jésus-Christ, de
            conduire les hommes et les femmes à une relation vivante avec
            Lui, de les accompagner dans leur croissance spirituelle, de les
            former comme disciples, de les équiper pour le service et de les
            envoyer afin qu&apos;ils manifestent la vie abondante de Dieu et
            les valeurs du Royaume dans tous les domaines de la société, par
            la Parole et le Saint-Esprit.
          </p>

          <ol className="vision-mission__steps">
            {missionSteps.map((step, index) => (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
              >
                <span
                  className="vision-mission__step-number"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <span>
                  <strong>{step.verb}</strong> {step.text}
                </span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default VisionMission;
