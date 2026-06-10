import { ArrowRight } from "lucide-react";
import MediaCard from "../MediaCard/MediaCard";

import "./MediaSection.scss";


const MediaSection = ({
  title,
  buttonText,
  items
}) => {
  return (
    <section className="media-section">

      <div className="media-section__header">

        <h2>{title}</h2>

        <button>
          {buttonText}
          <ArrowRight size={18} />
        </button>

      </div>

      <div className="media-grid">

        {items.map((item, index) => (
          <MediaCard
            key={index}
            item={item}
          />
        ))}

      </div>

    </section>
  );
};

export default MediaSection;