const MinistryEvents = ({
  events = [],
}) => {
  return (
    <section className="ministry-events">

      <div className="container">

        <h2>
          Prochains Événements
        </h2>

        <div className="events-grid">

          {events.length > 0 ? (
            events.map(
              (event, index) => (
                <div
                  key={index}
                  className="event-card"
                >
                  <strong>
                    {event.date}
                  </strong>

                  <h3>
                    {event.title}
                  </h3>

                  {event.description && (
                    <p>
                      {event.description}
                    </p>
                  )}
                </div>
              )
            )
          ) : (
            <div className="event-card">

              <strong>
                À venir
              </strong>

              <h3>
                Aucun événement programmé
              </h3>

            </div>
          )}

        </div>

      </div>

    </section>
  );
};

export default MinistryEvents;