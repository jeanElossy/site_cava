const MinistryLeaders = ({
  leaders = [],
}) => {
  return (
    <section className="ministry-leaders">

      <div className="container">

        <h2>
          Nos Responsables
        </h2>

        <div className="leaders-grid">

          {leaders.length > 0 ? (
            leaders.map(
              (leader, index) => (
                <div
                  key={index}
                  className="leader-card"
                >

                  <img
                    src={leader.image}
                    alt={leader.name}
                  />

                  <div>

                    <h3>
                      {leader.name}
                    </h3>

                    <span>
                      {leader.role}
                    </span>

                    <p>
                      {leader.description}
                    </p>

                  </div>

                </div>
              )
            )
          ) : (
            <div className="leader-card">

              <div>

                <h3>
                  Aucun responsable renseigné
                </h3>

              </div>

            </div>
          )}

        </div>

      </div>

    </section>
  );
};

export default MinistryLeaders;