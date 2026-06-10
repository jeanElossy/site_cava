import { Play } from "lucide-react";

import "./MediaCard.scss";

const MediaCard = ({ item }) => {
  return (
    <article className="media-card">

      <div className="media-card__image">

        <img
          src={item.image}
          alt={item.title}
        />

        <div className="media-card__play">
          <Play size={28} />
        </div>

      </div>

      <div className="media-card__content">

        <h3>{item.title}</h3>

        <p>{item.author}</p>

        <div className="meta">
          <span>{item.date}</span>
          <span>{item.duration}</span>
        </div>

      </div>

    </article>
  );
};

export default MediaCard;