import { motion } from "framer-motion";

import Navbar from "../../components/Navbar/Navbar";
import Hero from "../../components/Hero/Hero";
import Values from "../../components/Values/Values";
import Events from "../../components/Events/Events";
import Verse from "../../components/Verse/Verse";
import LastMessage from "../../components/LastMessage/LastMessage";
import Ministries from "../../components/Ministries/Ministries";
import Footer from "../../components/Footer/Footer";

import usePageMeta from "../../hooks/usePageMeta";

import "./Home.scss";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 50
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8
    }
  }
};

const Home = () => {
  usePageMeta({
    title: "Accueil",
    description:
      "Le Centre Apostolique Vie et Abondance (CAVA) est une église d'Abidjan centrée sur Christ : cultes, ministères, événements et enseignements.",
  });

  return (
    <>
      <Navbar />

      <Hero />

      <Values />

      <section className="home-grid">

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <Events />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
        >
          <Verse />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <LastMessage />
        </motion.div>

      </section>

      <Ministries />

      <Footer />
    </>
  );
};

export default Home;