import { useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { newSouls } from "../../../services/api";
import { currentUser } from "../../../services/auth";
import usePageMeta from "../../../hooks/usePageMeta";
import useAsyncData from "../../../hooks/useAsyncData";
import StatusBadge from "../../../components/newSouls/shared/StatusBadge";
import JourneyTimeline from "../../../components/newSouls/shared/JourneyTimeline";
import SOAWizard from "../../../components/newSouls/SOAWizard/SOAWizard";
import CANAWizard from "../../../components/newSouls/CANAWizard/CANAWizard";
import "../../../components/newSouls/shared/NewSouls.scss";

// Bascule entre le wizard SOA (dossier pas encore transmis) et le
// wizard CANA (dossier transmis, `soa.lockedAt` posé) — la même
// logique que côté serveur (`SOA_EDITABLE_STATUSES`), sans dupliquer
// l'énumération complète des statuts.
const NewSoulDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = currentUser()?.role;

  const loader = useCallback(() => newSouls.get(id), [id]);
  const { data: record, loading, error, reload } = useAsyncData(loader);

  usePageMeta({
    title: record ? `Dossier ${record.caseNumber}` : "Nouvelle âme",
    description: "Suivi du dossier SOA/CANA.",
  });

  if (loading) return <p>Chargement…</p>;

  if (error) {
    return (
      <div className="new-soul-list">
        <p className="admin-form__error">{error}</p>
        <Link to="/admin/nouvelles-ames">← Retour à la liste</Link>
      </div>
    );
  }

  if (!record) return null;

  const transmitted = Boolean(record.soa?.lockedAt);

  return (
    <div className="new-soul-list">
      <header className="new-soul-list__toolbar">
        <div>
          <Link to="/admin/nouvelles-ames">← Nouvelles âmes</Link>
          <h1>
            {record.caseNumber} — {record.soa?.lastName} {record.soa?.firstName}
          </h1>
        </div>
        <StatusBadge status={record.status} />
      </header>

      <JourneyTimeline status={record.status} statusHistory={record.statusHistory} />

      {transmitted ? (
        <CANAWizard newSoul={record} currentRole={role} onUpdated={reload} />
      ) : (
        <SOAWizard
          newSoul={record}
          onTransmitted={() => {
            reload();
            navigate(`/admin/nouvelles-ames/${id}`, { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default NewSoulDetailPage;
