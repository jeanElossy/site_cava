import StatusBadge from "../shared/StatusBadge";
import "../shared/NewSouls.scss";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "—");

const initialsOf = (firstName, lastName) =>
  [firstName, lastName]
    .filter(Boolean)
    .map((part) => part.trim()[0]?.toUpperCase())
    .filter(Boolean)
    .join("") || "?";

const Item = ({ label, value }) => (
  <div className="new-soul-readonly__item">
    <span className="new-soul-readonly__label">{label}</span>
    <span className="new-soul-readonly__value">{value || "—"}</span>
  </div>
);

// Toutes les informations enregistrées par le SOA (§A à §G),
// affichées en LECTURE SEULE — jamais un champ modifiable ici. C'est
// l'exigence métier centrale du module : la CANA ne ressaisit rien.
const ReadonlySOAInfo = ({ soa, caseNumber, status }) => (
  <div className="new-soul-readonly">
    <div className="new-soul-readonly__header">
      <div className="new-soul-readonly__identity">
        <span className="new-soul-readonly__avatar">
          {initialsOf(soa.firstName, soa.lastName)}
        </span>
        <div>
          <h3 className="new-soul-readonly__title">
            {`${soa.lastName ?? ""} ${soa.firstName ?? ""}`.trim() || "Dossier SOA"}
          </h3>
          <p className="new-soul-readonly__subtitle">
            Dossier {caseNumber} — enregistré par le SOA
          </p>
        </div>
      </div>

      {status && <StatusBadge status={status} />}
    </div>

    <div className="new-soul-readonly__grid">
      <Item label="Nom & prénoms" value={`${soa.lastName ?? ""} ${soa.firstName ?? ""}`.trim()} />
      <Item label="Sexe" value={soa.gender === "homme" ? "Homme" : soa.gender === "femme" ? "Femme" : ""} />
      <Item label="Catégorie" value={soa.category} />
      <Item label="Téléphone" value={soa.phone} />
      <Item label="WhatsApp" value={soa.whatsapp} />
      <Item label="Quartier" value={soa.area} />
      <Item label="Repère géographique" value={soa.landmark} />
      <Item label="Culte / activité" value={soa.service} />
      <Item label="Date d'ouverture" value={formatDate(soa.openedAt)} />
      <Item label="Premier passage" value={formatDate(soa.firstVisitAt)} />
      <Item label="Agent SOA" value={soa.agentName} />
      <Item label="Provenance" value={soa.origin === "autre" ? soa.originOther : soa.origin} />
      <Item label="Invité(e) par" value={soa.invitedBy} />
      <Item label="Décision spirituelle" value={soa.decision === "autre" ? soa.decisionOther : soa.decision} />
      <Item label="Baptême d'eau" value={soa.waterBaptism} />
      <Item label="Consentement CANA" value={soa.consent} />
      <Item label="Transmis le" value={formatDate(soa.transmittedAt)} />
      <Item label="Transmis par" value={soa.transmittedBy} />
    </div>

    {soa.needs?.length > 0 && (
      <Item label="Besoins exprimés" value={soa.needs.join(", ")} />
    )}
    {soa.observations && <Item label="Observations du SOA" value={soa.observations} />}
  </div>
);

export default ReadonlySOAInfo;
