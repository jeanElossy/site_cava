import { motion } from "framer-motion";

import "./Verse.scss";

import verseImage from "../../assets/images/bible.jpg";

// Jean 10:10, qui fait écho au nom de l'église (« la vie… en
// abondance »).
const Verse = () => {
  return (
    <section
      className="home-verse"
      style={{ backgroundImage: `url(${verseImage})` }}
      aria-label="Verset biblique"
    >
      <div
        className="home-verse__overlay"
        aria-hidden="true"
      ></div>

      <motion.figure
        className="home-verse__inner"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <span
          className="home-verse__mark"
          aria-hidden="true"
        >
          “
        </span>

        {/* Points de suspension en tête : le verset est une citation
            partielle (le début de Jean 10:10 parle du voleur). */}
        <blockquote>
          … Je suis venu afin que les brebis aient la vie, et qu&apos;elles
          soient dans l&apos;abondance.
        </blockquote>

        <figcaption>Jean 10:10</figcaption>
      </motion.figure>
    </section>
  );
};

export default Verse;
