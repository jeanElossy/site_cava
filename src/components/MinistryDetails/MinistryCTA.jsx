const MinistryCTA = ({
  ministry,
}) => {
  return (
    <section className="ministry-cta">

      <div className="overlay" />

      <div className="container">

        <h2>
          Rejoignez le ministère
          {" "}
          {ministry.title}
        </h2>

        <p>
          Découvrez votre appel et
          servez avec nous pour impacter
          des vies et faire avancer le
          Royaume de Dieu.
        </p>

        <button>
          Rejoindre maintenant
        </button>

      </div>

    </section>
  );
};

export default MinistryCTA;