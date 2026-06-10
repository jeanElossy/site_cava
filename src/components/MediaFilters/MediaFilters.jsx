import "./MediaFilters.scss";

const tabs = [
  "Tous",
  "Messages",
  "Louanges",
  "Témoignages"
];

export default function MediaFilters({
  active,
  setActive
}) {
  return (
    <section className="media-filters">

      <div className="media-filters__wrapper">

        {tabs.map((tab) => (
          <button
            key={tab}
            className={
              active === tab
                ? "media-filters__btn active"
                : "media-filters__btn"
            }
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}

      </div>

    </section>
  );
}