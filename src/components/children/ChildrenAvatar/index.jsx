import "./ChildrenAvatar.scss";

// Pastille d'identité : photo si elle existe, initiales sinon.
//
// Les maquettes montrent des photos partout ; en pratique, la plupart
// des fiches n'en auront pas avant longtemps. Les initiales sur fond
// teinté évitent l'alternative habituelle — une silhouette grise
// générique répétée vingt fois dans un tableau.
const initials = (first, last) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

// Teinte dérivée du nom, stable d'un écran à l'autre : la même
// personne garde la même pastille partout. Volontairement des tons
// très désaturés — ce sont des repères, pas des données, et ils ne
// doivent jamais entrer en concurrence avec les couleurs des
// graphiques (voir ChildrenChart/palette.js).
const TONES = ["a", "b", "c", "d", "e"];

const toneFor = (seed) => {
  const text = String(seed ?? "");

  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 997;
  }

  return TONES[hash % TONES.length];
};

const ChildrenAvatar = ({ firstName, lastName, photo, size = "md" }) => {
  const label = `${firstName ?? ""} ${lastName ?? ""}`.trim();

  if (photo) {
    return (
      <img
        className={`children-avatar children-avatar--${size}`}
        src={photo}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`children-avatar children-avatar--${size} children-avatar--tone-${toneFor(label)}`}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </span>
  );
};

export default ChildrenAvatar;
