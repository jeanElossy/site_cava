import { motion } from "framer-motion";

import "./MinistryGallery.scss";

const MinistryGallery = ({ images = [], ministryTitle = "" }) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <section
      className="ministry-gallery"
      aria-labelledby="ministry-gallery-title"
    >
      <div className="ministry-gallery__container">
        <header className="ministry-gallery__header">
          <h2 id="ministry-gallery-title">Galerie</h2>

          <div className="ministry-gallery__line" />
        </header>

        <div className="ministry-gallery__grid">
          {images.map((image, index) => (
            <motion.figure
              key={image}
              className="ministry-gallery__item"
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              <img
                src={image}
                alt={
                  ministryTitle
                    ? `${ministryTitle} — photo ${index + 1}`
                    : `Photo ${index + 1} du ministère`
                }
                loading="lazy"
              />
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MinistryGallery;
