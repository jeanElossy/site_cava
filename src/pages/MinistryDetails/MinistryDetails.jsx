import { useParams } from "react-router-dom";



const ministries = {
  "enfance-jeunesse": {
    title: "Enfance & Jeunesse",
    description:
      "Accompagner les enfants et les jeunes dans leur marche avec Christ.",
  },

  "louange-adoration": {
    title: "Louange & Adoration",
    description:
      "Élever un son qui transforme les cœurs et attire la présence de Dieu.",
  },

  "enseignement": {
    title: "Enseignement",
    description:
      "La parole de Dieu enseignée avec clarté pour une vie transformée.",
  },

  "action-sociale": {
    title: "Action Sociale",
    description:
      "Manifester l'amour de Christ par des actions concrètes.",
  },
};

const MinistryDetails = () => {
  const { slug } = useParams();

  const ministry =
    ministries[slug];

  if (!ministry) {
    return (
      <div>
        Ministère introuvable
      </div>
    );
  }

  return (
    <section>

      <h1>
        {ministry.title}
      </h1>

      <p>
        {ministry.description}
      </p>

    </section>
  );
};

export default MinistryDetails;