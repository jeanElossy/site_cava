import { AlertTriangle } from "lucide-react";

import "./LegalContent.scss";

const renderBlock = (block, index) => {
  if (block.type === "placeholder") {
    return (
      <p key={index} className="legal-content__placeholder">
        <AlertTriangle size={17} aria-hidden="true" />

        <span>
          <strong>À COMPLÉTER :</strong> {block.label}
        </span>
      </p>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={index} className="legal-content__list">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={index} className="legal-content__paragraph">
      {block.text}
    </p>
  );
};

const LegalContent = ({ sections }) => {
  return (
    <section className="legal-content">
      <div className="legal-content__container">
        <nav
          className="legal-content__summary"
          aria-label="Sommaire"
        >
          <h2>Sommaire</h2>

          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {sections.map((section) => (
          <article
            key={section.id}
            id={section.id}
            className="legal-content__section"
          >
            <h2 className="legal-content__heading">
              {section.title}
            </h2>

            {section.blocks.map(renderBlock)}
          </article>
        ))}
      </div>
    </section>
  );
};

export default LegalContent;
