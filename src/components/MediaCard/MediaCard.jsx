import { Play, ExternalLink } from "lucide-react";

import {
  isPlayable,
  externalUrl,
} from "../Media/data/medias";

import "./MediaCard.scss";

// La carte adapte son comportement à la source du média :
//   - vidéo embarquable (youtube / fichier) → <button> qui ouvre le
//     lecteur sur le site, sans quitter la page ;
//   - lien externe ou aucune vidéo → <a> vers la destination, nouvel
//     onglet.
//
// On n'affiche jamais un bouton lecture qui ne mène nulle part : l'icône
// change pour signaler une sortie du site.
const MediaCard = ({ item, onPlay }) => {
  const playable = isPlayable(item);

  const inner = (
    <>
      <div className="media-card__image">

        <img
          src={item.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />

        <span className="media-card__play">
          {playable ? (
            <Play size={26} aria-hidden="true" />
          ) : (
            <ExternalLink size={22} aria-hidden="true" />
          )}
        </span>

      </div>

      <div className="media-card__content">

        <h3>{item.title}</h3>

        <p>{item.author}</p>

        <div className="meta">
          <span>{item.date}</span>
          <span>{item.duration}</span>
        </div>

      </div>
    </>
  );

  if (playable) {
    return (
      <article className="media-card">
        <button
          type="button"
          className="media-card__trigger"
          onClick={() => onPlay(item)}
          aria-label={`Lire : ${item.title}`}
        >
          {inner}
        </button>
      </article>
    );
  }

  return (
    <article className="media-card">
      <a
        className="media-card__trigger"
        href={externalUrl(item)}
        target="_blank"
        rel="noreferrer"
        aria-label={`${item.title} — ouvrir dans un nouvel onglet`}
      >
        {inner}
      </a>
    </article>
  );
};

export default MediaCard;
