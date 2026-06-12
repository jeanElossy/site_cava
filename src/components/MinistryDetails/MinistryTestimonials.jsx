const MinistryTestimonials = ({
  testimonials = [],
}) => {
  return (
    <section className="ministry-testimonials">

      <div className="container">

        <h2>
          Témoignages
        </h2>

        <div className="testimonials-grid">

          {testimonials.length > 0 ? (
            testimonials.map(
              (
                testimonial,
                index
              ) => (
                <div
                  key={index}
                  className="testimonial-card"
                >

                  <p>
                    "{testimonial.message}"
                  </p>

                  <span>
                    {testimonial.author}
                  </span>

                </div>
              )
            )
          ) : (
            <div className="testimonial-card">

              <p>
                Aucun témoignage disponible
                pour le moment.
              </p>

            </div>
          )}

        </div>

      </div>

    </section>
  );
};

export default MinistryTestimonials;