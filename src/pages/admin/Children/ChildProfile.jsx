import { useCallback, useState } from "react";

import { Link, useParams } from "react-router-dom";

import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Trash2,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import ChildrenPage, {
  ChildrenPanel,
} from "../../../components/children/ChildrenPage";

import ChildrenAvatar from "../../../components/children/ChildrenAvatar";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import useAsyncData from "../../../hooks/useAsyncData";

import {
  childAttendance,
  deleteDocument,
  getChild,
  listDocuments,
  openDocument,
} from "../../../services/children";

import { formatLongDate, relativeDay } from "../../../utils/childrenDates";

import "./Children.scss";

const TABS = [
  { key: "identite", label: "Informations générales", icon: UserRound },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "responsables", label: "Parents / Responsables", icon: Users },
  { key: "classe", label: "Classe & moniteurs", icon: GraduationCap },
  { key: "presences", label: "Présences", icon: CalendarDays },
];

const RELATION_LABELS = {
  pere: "Père",
  mere: "Mère",
  tuteur: "Tuteur",
  "grand-parent": "Grand-parent",
  oncle: "Oncle",
  tante: "Tante",
  frere: "Frère",
  soeur: "Sœur",
  autre: "Autre",
};

const MISSING_LABELS = {
  dateOfBirth: "date de naissance",
  gender: "sexe",
  currentClass: "classe",
  guardians: "responsable",
};

const DOCUMENT_TYPES = {
  acte_naissance: "Acte de naissance",
  piece_identite: "Pièce d'identité",
  autorisation_parentale: "Autorisation parentale",
  autorisation_participation: "Autorisation de participation",
  certificat_medical: "Certificat médical",
  informations_medicales: "Informations médicales",
  autre: "Autre document",
};

const readableSize = (bytes) => {
  if (!bytes) return "—";

  const mb = bytes / (1024 * 1024);

  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.round(bytes / 1024)} Ko`;
};

/**
 * Fiche complète d'un enfant.
 *
 * ------------------------------------------------------------------
 * CHAQUE ONGLET CHARGE SES PROPRES DONNÉES
 * ------------------------------------------------------------------
 * Ni les documents ni l'historique de présence n'arrivent avec la
 * fiche : ils ont leurs propres routes, paginées, et ne sont demandés
 * qu'à l'ouverture de leur onglet. Une fiche qui chargerait tout
 * d'avance ralentirait l'écran le plus consulté du module pour des
 * informations qu'on ne regarde qu'une fois sur dix.
 */
const ChildProfile = () => {
  const { id } = useParams();

  const [tab, setTab] = useState("identite");

  const load = useCallback(() => getChild(id), [id]);

  const { data: child, loading, error, reload } = useAsyncData(load);

  if (loading) return <AdminLoading />;

  if (error) {
    return (
      <AdminError
        message={error}
        onRetry={reload}
      />
    );
  }

  const missing = child?.missingFields ?? [];

  return (
    <ChildrenPage
      title={`${child.firstName} ${child.lastName}`}
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants", to: "/admin/enfants" },
        { label: "Liste", to: "/admin/enfants/liste" },
        { label: `${child.firstName} ${child.lastName}` },
      ]}
      aside={
        <>
          <ChildrenPanel title="Résumé du dossier">
            <div className="children-profile__summary">
              <ChildrenAvatar
                firstName={child.firstName}
                lastName={child.lastName}
                photo={child.photo}
                size="lg"
              />

              <div>
                <strong>
                  {child.firstName} {child.lastName}
                </strong>

                <code>{child.fileNumber}</code>
              </div>
            </div>

            <dl className="children-profile__facts">
              <div>
                <dt>Statut</dt>
                <dd>
                  <span
                    className={
                      child.status === "actif"
                        ? "children-badge children-badge--success"
                        : "children-badge children-badge--muted"
                    }
                  >
                    {child.status === "actif" ? "Actif" : "Inactif"}
                  </span>
                </dd>
              </div>

              <div>
                <dt>Classe</dt>
                <dd>
                  {child.currentClass ? (
                    <span className="children-badge">
                      {child.currentClass.icon} {child.currentClass.name}
                    </span>
                  ) : (
                    <span className="children-table__muted">Non affecté</span>
                  )}
                </dd>
              </div>

              <div>
                <dt>Inscrit le</dt>
                <dd>{formatLongDate(child.enrolledAt)}</dd>
              </div>
            </dl>
          </ChildrenPanel>

          {/* Le registre papier ne porte ni date de naissance, ni sexe,
              ni responsables. Plutôt que de laisser découvrir ces vides
              au hasard des consultations, la fiche dit ce qui manque. */}
          {missing.length > 0 && (
            <ChildrenPanel title="Dossier à compléter">
              <p className="children-note">
                <TriangleAlert
                  aria-hidden="true"
                  className="children-profile__warn-icon"
                />
                {child.source === "registre"
                  ? "Fiche reprise du registre papier, qui ne portait que les noms."
                  : "Informations manquantes :"}
              </p>

              <ul className="children-missing">
                {missing.map((field) => (
                  <li key={field}>{MISSING_LABELS[field] ?? field}</li>
                ))}
              </ul>
            </ChildrenPanel>
          )}
        </>
      }
    >
      <div
        className="children-subtabs"
        role="tablist"
      >
        {TABS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={
                tab === item.key
                  ? "children-subtabs__tab children-subtabs__tab--active"
                  : "children-subtabs__tab"
              }
              onClick={() => setTab(item.key)}
            >
              <Icon aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "identite" && <IdentityTab child={child} />}

      {tab === "documents" && <DocumentsTab childId={id} />}

      {tab === "responsables" && <GuardiansTab child={child} />}

      {tab === "classe" && <ClassTab child={child} />}

      {tab === "presences" && <AttendanceTab childId={id} />}
    </ChildrenPage>
  );
};

// ---- Onglet 1 : identité --------------------------------------------

const IdentityTab = ({ child }) => (
  <section className="children-panel-block">
    <dl className="children-facts">
      <Fact
        label="Numéro de dossier"
        value={<code>{child.fileNumber}</code>}
      />

      <Fact
        label="Nom"
        value={child.lastName}
      />

      <Fact
        label="Prénom(s)"
        value={child.firstName}
      />

      <Fact
        label="Date de naissance"
        value={
          child.dateOfBirth
            ? `${formatLongDate(child.dateOfBirth)}${
                typeof child.age === "number" ? ` (${child.age} ans)` : ""
              }`
            : null
        }
      />

      <Fact
        label="Sexe"
        value={
          child.gender === "garcon"
            ? "Garçon"
            : child.gender === "fille"
              ? "Fille"
              : null
        }
      />

      <Fact
        label="Lieu de naissance"
        value={child.birthPlace}
      />

      <Fact
        label="Nationalité"
        value={child.nationality}
      />

      <Fact
        label="Langue parlée à la maison"
        value={child.homeLanguage}
      />

      <Fact
        label="Adresse"
        value={child.address}
      />

      <Fact
        label="Date d'inscription"
        value={formatLongDate(child.enrolledAt)}
      />
    </dl>

    {child.notes && (
      <div className="children-internal-note">
        <strong>Note interne</strong>

        <p>{child.notes}</p>
      </div>
    )}
  </section>
);

const Fact = ({ label, value }) => (
  <div>
    <dt>{label}</dt>

    <dd>
      {value || <span className="children-table__muted">Non renseigné</span>}
    </dd>
  </div>
);

// ---- Onglet 2 : documents -------------------------------------------

const DocumentsTab = ({ childId }) => {
  const load = useCallback(() => listDocuments(childId), [childId]);

  const { data, loading, error, reload } = useAsyncData(load);

  const [opening, setOpening] = useState(null);

  if (loading) return <AdminLoading />;

  if (error) {
    return (
      <AdminError
        message={error}
        onRetry={reload}
      />
    );
  }

  const items = data?.items ?? [];
  const storage = data?.storage;

  /**
   * Ouvre un document protégé.
   *
   * L'URL est demandée AU MOMENT DU CLIC, jamais chargée d'avance avec
   * la liste : elle n'est valable que quelques minutes, et chaque
   * délivrance est journalisée côté serveur. La pré-charger reviendrait
   * à tracer une consultation qui n'a pas eu lieu — et à laisser
   * circuler des liens que personne n'a ouverts.
   */
  const open = async (document, download = false) => {
    setOpening(document.id);

    try {
      const link = await openDocument(childId, document.id, { download });

      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      window.alert(caught.message);
    } finally {
      setOpening(null);
    }
  };

  const remove = async (document) => {
    if (
      !window.confirm(
        `Supprimer définitivement « ${document.name} » ? Le fichier sera effacé du stockage.`
      )
    ) {
      return;
    }

    try {
      await deleteDocument(childId, document.id);

      reload();
    } catch (caught) {
      window.alert(caught.message);
    }
  };

  return (
    <section className="children-panel-block">
      <div className="children-storage">
        <div>
          <strong>{readableSize(storage?.used)}</strong>

          <span>
            sur {readableSize(storage?.quota)} — {items.length} document
            {items.length > 1 ? "s" : ""}
          </span>
        </div>

        <div
          className="children-storage__track"
          role="img"
          aria-label={`Espace utilisé : ${storage?.percent ?? 0} %`}
        >
          <span style={{ width: `${Math.min(100, storage?.percent ?? 0)}%` }} />
        </div>
      </div>

      <p className="children-confidential">
        Les documents des enfants sont <strong>confidentiels</strong>. Ils ne
        sont jamais accessibles par une adresse publique : chaque consultation
        ouvre un lien valable quelques minutes, et elle est enregistrée dans
        l&apos;historique.
      </p>

      {items.length === 0 ? (
        <AdminEmpty message="Aucun document dans ce dossier." />
      ) : (
        <div className="children-table-wrap">
          <table className="children-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Document</th>
                <th>Ajouté par</th>
                <th>Statut</th>
                <th aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {items.map((document) => (
                <tr key={document.id}>
                  <td>{DOCUMENT_TYPES[document.type] ?? document.type}</td>

                  <td>
                    <span className="children-daycell">
                      <span className="children-daycell__date">
                        {document.name}
                      </span>

                      <span className="children-daycell__range">
                        {readableSize(document.bytes)} —{" "}
                        {formatLongDate(document.createdAt)}
                      </span>
                    </span>
                  </td>

                  <td>
                    <span className="children-daycell">
                      <span className="children-daycell__date">
                        {document.uploadedBy?.name ?? "—"}
                      </span>

                      {document.uploadedBy?.label && (
                        <span className="children-daycell__range">
                          {document.uploadedBy.label}
                        </span>
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        document.status === "valide"
                          ? "children-badge children-badge--success"
                          : document.status === "refuse"
                            ? "children-badge children-badge--danger"
                            : "children-badge children-badge--warning"
                      }
                    >
                      {document.status === "valide"
                        ? "Validé"
                        : document.status === "refuse"
                          ? "Refusé"
                          : "En attente"}
                    </span>
                  </td>

                  <td>
                    <div className="children-table__actions">
                      <button
                        type="button"
                        className="children-button children-button--ghost"
                        onClick={() => open(document)}
                        disabled={opening === document.id}
                        aria-label={`Consulter ${document.name}`}
                        title="Consulter"
                      >
                        <Eye aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="children-button children-button--ghost"
                        onClick={() => open(document, true)}
                        disabled={opening === document.id}
                        aria-label={`Télécharger ${document.name}`}
                        title="Télécharger"
                      >
                        <Download aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="children-button children-button--ghost"
                        onClick={() => remove(document)}
                        aria-label={`Supprimer ${document.name}`}
                        title="Supprimer"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ---- Onglet 3 : responsables ----------------------------------------

const GuardiansTab = ({ child }) => {
  const guardians = child.guardians ?? [];

  if (guardians.length === 0) {
    return (
      <section className="children-panel-block">
        <AdminEmpty message="Aucun responsable rattaché à cet enfant." />

        <p className="children-note">
          Enregistrez d&apos;abord le responsable dans{" "}
          <Link to="/admin/enfants/responsables">
            Parents / Responsables
          </Link>
          , puis rattachez-le ici. Une fratrie partage ainsi les mêmes parents.
        </p>
      </section>
    );
  }

  return (
    <section className="children-panel-block">
      <div className="children-guardians">
        {guardians.map((link) => (
          <article
            key={link.guardian?.id ?? link.guardian}
            className="children-guardians__card"
          >
            <header>
              <ChildrenAvatar
                firstName={link.guardian?.firstName}
                lastName={link.guardian?.lastName}
                size="md"
              />

              <div>
                <strong>
                  {link.guardian?.firstName} {link.guardian?.lastName}
                </strong>

                <em>{RELATION_LABELS[link.relation] ?? link.relation}</em>
              </div>
            </header>

            <dl>
              <div>
                <dt>Responsable légal</dt>
                <dd>
                  <span
                    className={
                      link.isLegalGuardian
                        ? "children-badge children-badge--success"
                        : "children-badge children-badge--muted"
                    }
                  >
                    {link.isLegalGuardian ? "Oui" : "Non"}
                  </span>
                </dd>
              </div>

              <div>
                <dt>Autorisé à récupérer</dt>
                <dd>
                  <span
                    className={
                      link.canPickUp
                        ? "children-badge children-badge--success"
                        : "children-badge children-badge--danger"
                    }
                  >
                    {link.canPickUp ? "Oui" : "Non"}
                  </span>
                </dd>
              </div>
            </dl>

            {link.guardian?.phone && (
              <p className="children-guardians__contact">
                {link.guardian.phone}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

// ---- Onglet 4 : classe ----------------------------------------------

const ClassTab = ({ child }) => (
  <section className="children-panel-block">
    {child.currentClass ? (
      <dl className="children-facts">
        <Fact
          label="Classe actuelle"
          value={`${child.currentClass.icon ?? ""} ${child.currentClass.name}`}
        />

        <Fact
          label="Date d'affectation"
          value={
            child.classAssignedAt ? formatLongDate(child.classAssignedAt) : null
          }
        />

        <Fact
          label="Salle"
          value={child.currentClass.room}
        />

        <Fact
          label="Horaire habituel"
          value={
            child.currentClass.usualStartTime
              ? `${child.currentClass.usualDay} ${child.currentClass.usualStartTime}${
                  child.currentClass.usualEndTime
                    ? ` – ${child.currentClass.usualEndTime}`
                    : ""
                }`
              : null
          }
        />
      </dl>
    ) : (
      <AdminEmpty message="Cet enfant n'est affecté à aucune classe." />
    )}

    <p className="children-note">
      Les moniteurs affichés dans l&apos;espace de chaque classe sont ceux de la
      classe, jamais rattachés à l&apos;enfant lui-même : un changement de
      moniteur n&apos;oblige donc pas à modifier chaque fiche.{" "}
      <Link to="/admin/enfants/moniteurs">Voir les moniteurs</Link>.
    </p>
  </section>
);

// ---- Onglet 5 : présences -------------------------------------------

const AttendanceTab = ({ childId }) => {
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => childAttendance(childId, { page, limit: 20 }),
    [childId, page]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  if (loading) return <AdminLoading />;

  if (error) {
    return (
      <AdminError
        message={error}
        onRetry={reload}
      />
    );
  }

  const items = data?.items ?? [];
  const meta = data?.meta ?? null;
  const stats = data?.stats;

  return (
    <section className="children-panel-block">
      {stats && stats.total > 0 && (
        <div className="children-page__stats">
          <article className="children-page__stat children-page__stat--success">
            <div className="children-page__stat-body">
              <strong className="children-page__stat-value">
                {stats.rate} %
              </strong>

              <span className="children-page__stat-label">
                Taux de présence
              </span>

              <span className="children-page__stat-hint">
                sur {stats.total} séance{stats.total > 1 ? "s" : ""}
              </span>
            </div>
          </article>

          <article className="children-page__stat">
            <div className="children-page__stat-body">
              <strong className="children-page__stat-value">
                {stats.present}
              </strong>

              <span className="children-page__stat-label">Présences</span>
            </div>
          </article>

          <article className="children-page__stat children-page__stat--danger">
            <div className="children-page__stat-body">
              <strong className="children-page__stat-value">
                {stats.absent}
              </strong>

              <span className="children-page__stat-label">Absences</span>
            </div>
          </article>

          <article className="children-page__stat children-page__stat--warning">
            <div className="children-page__stat-body">
              <strong className="children-page__stat-value">
                {stats.excuse}
              </strong>

              <span className="children-page__stat-label">Excusées</span>
            </div>
          </article>
        </div>
      )}

      {items.length === 0 ? (
        <AdminEmpty message="Aucune présence enregistrée pour cet enfant." />
      ) : (
        <>
          <ul className="children-history">
            {items.map((entry) => (
              <li key={entry._id ?? entry.id}>
                <span className="children-history__date">
                  {formatLongDate(entry.date)}

                  {relativeDay(entry.date) && (
                    <em>{relativeDay(entry.date)}</em>
                  )}
                </span>

                <span className="children-history__body">
                  <strong>
                    {entry.session?.title ?? "Séance"}
                    {entry.class?.name ? ` — ${entry.class.name}` : ""}
                  </strong>

                  <em>
                    Enregistré par {entry.recordedBy?.firstName}{" "}
                    {entry.recordedBy?.lastName}

                    {/* L'exigence d'audit du remplacement : le nom du
                        remplaçant ET celui du moniteur remplacé, des
                        mois après. */}
                    {entry.substitution?.replacedMonitor && (
                      <>
                        {" "}
                        — en remplacement de{" "}
                        {entry.substitution.replacedMonitor.firstName}{" "}
                        {entry.substitution.replacedMonitor.lastName}
                      </>
                    )}
                  </em>
                </span>

                <span
                  className={
                    entry.status === "present"
                      ? "children-badge children-badge--success"
                      : entry.status === "excuse"
                        ? "children-badge children-badge--warning"
                        : "children-badge children-badge--danger"
                  }
                >
                  {entry.status === "present"
                    ? "Présent"
                    : entry.status === "excuse"
                      ? "Excusé"
                      : "Absent"}
                </span>
              </li>
            ))}
          </ul>

          {meta && meta.pages > 1 && (
            <nav
              className="children-pagination"
              aria-label="Pagination de l'historique"
            >
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={meta.page <= 1}
              >
                Précédent
              </button>

              <span>
                Page {meta.page} sur {meta.pages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(meta.pages, current + 1))
                }
                disabled={meta.page >= meta.pages}
              >
                Suivant
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
};

export default ChildProfile;
