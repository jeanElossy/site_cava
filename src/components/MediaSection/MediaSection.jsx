import { ArrowRight } from "lucide-react";
import MediaCard from "../MediaCard/MediaCard";

import "./MediaSection.scss";


const MediaSection = ({
  title,
  buttonText,
  onButtonClick,
  onPlay,
  items
}) => {
  return (
    <section className="media-section">

      <div className="media-section__header">

        <h2>{title}</h2>

        {/*
          Le bouton applique le filtre correspondant de la page Médias.
          Il n'est rendu que si une action lui est fournie : lorsqu'un
          filtre est déjà actif, il n'aurait plus de destination.
        */}
        {buttonText && onButtonClick && (
          <button type="button" onClick={onButtonClick}>
            {buttonText}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}

      </div>

      <div className="media-grid">

        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onPlay={onPlay}
          />
        ))}

      </div>

    </section>
  );
};

export default MediaSection;
