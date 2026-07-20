import { ArrowRight, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import heroBg from "../../assets/images/hero-bg.jpg";
import logoCava from "../../assets/logo/logo_cava.gif";

import "./Hero.scss";

const Hero = () => {
  return (
    <section
      className="hero"
      style={{
        backgroundImage: `url(${heroBg})`,
      }}
    >
      <div className="hero__overlay"></div>

      <div className="hero__container">

        <motion.div
          className="hero__content"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
        >
          <span className="hero__subtitle">
            BIENVENUE AU
          </span>

          <h1>
            Centre Apostolique
            <br />
            Vie et Abondance
          </h1>

          <div className="hero__line"></div>

          <p>
            Un lieu où la foi prend vie,
            l'amour se partage
            et la destinée s'accomplit en Jésus-Christ.
          </p>

          <div className="hero__buttons">

            <Link
              to="/about"
              className="btn-yellow"
            >
              Nous découvrir
              <ArrowRight size={20} />
            </Link>

            <Link
              to="/events"
              className="btn-outline"
            >
              Nos cultes
              <CalendarDays size={18} />
            </Link>

          </div>

        </motion.div>

        <img
          src={logoCava}
          alt="Logo CAVA"
          className="hero__logo"
        />

      </div>
    </section>
  );
};

export default Hero;