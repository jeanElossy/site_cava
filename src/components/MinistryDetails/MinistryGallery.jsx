const MinistryGallery = ({
  images = [],
}) => {
  return (
    <section className="ministry-gallery">

      <div className="container">

        <h2>
          Galerie
        </h2>

        <div className="gallery-grid">

          {images.length > 0 ? (
            images.map(
              (image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Galerie ${index + 1}`}
                />
              )
            )
          ) : (
            <div className="gallery-empty">
              Aucune image disponible
            </div>
          )}

        </div>

      </div>

    </section>
  );
};

export default MinistryGallery;