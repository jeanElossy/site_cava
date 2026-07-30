import { useEffect, useState } from "react";

import { CheckCircle2, XCircle } from "lucide-react";

import {
  memberSubmissions,
  flocks as flocksApi,
  churches as churchesApi,
} from "../../../services/api";

import useAsyncData from "../../../hooks/useAsyncData";

import AdminModal from "../AdminModal";
import { AdminEmpty, AdminError, AdminLoading } from "../AdminFeedback";

import "./SubmissionsPanel.scss";

const FIELD_LABELS = {
  firstName: "Prénom",
  lastName: "Nom",
  email: "E-mail",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  address: "Adresse",
  church: "Église",
  flock: "Bergerie",
  dateOfBirth: "Date de naissance",
  gender: "Genre",
  maritalStatus: "Situation matrimoniale",
  childrenCount: "Nombre d'enfants",
  conversionYear: "Année de conversion",
  previousChurch: "Église précédente",
  profession: "Profession",
  desiredDepartment: "Département souhaité",
  availability: "Disponibilités",
};

const KIND_LABELS = { new: "Nouveau", update: "Mise à jour" };

const EDITABLE_FIELDS = ["firstName", "lastName", "phone", "email"];

const formatValue = (field, value, flockNames, churchNames) => {
  if (value === undefined || value === null || value === "") return "—";

  if (field === "church") return churchNames[value] ?? `Église ${value}`;
  if (field === "flock") return flockNames[value] ?? String(value);
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
};

const diffFields = (before = {}, after = {}, flockNames, churchNames) =>
  Object.keys(FIELD_LABELS)
    .map((field) => ({
      field,
      label: FIELD_LABELS[field],
      before: formatValue(field, before[field], flockNames, churchNames),
      after: formatValue(field, after[field], flockNames, churchNames),
    }))
    .filter((row) => row.before !== row.after);

const SubmissionsPanel = () => {
  const { data, loading, error, reload } = useAsyncData(
    memberSubmissions.list
  );

  const [flockNames, setFlockNames] = useState({});
  const [churchNames, setChurchNames] = useState({});
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [overrides, setOverrides] = useState({});
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    flocksApi
      .listAdmin({ limit: 200 })
      .then((items) => {
        const map = {};

        for (const item of items) map[item.id] = item.name;

        setFlockNames(map);
      })
      .catch(() => setFlockNames({}));
  }, []);

  useEffect(() => {
    churchesApi
      .listAdmin({ limit: 200 })
      .then((items) => {
        const map = {};

        for (const item of items) map[item.number] = item.name;

        setChurchNames(map);
      })
      .catch(() => setChurchNames({}));
  }, []);

  const items = data?.items ?? [];

  const openDetail = async (submission) => {
    const id = submission.id ?? submission._id;

    setSelected(submission);
    setDetail(null);
    setDetailError("");
    setActionError("");
    setOverrides({});
    setRejecting(false);
    setRejectReason("");

    try {
      const result = await memberSubmissions.get(id);

      setDetail(result);
    } catch (caught) {
      setDetailError(
        caught?.message ?? "Impossible de charger la demande."
      );
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  const selectedId = () => selected?.id ?? selected?._id;

  const handleApprove = async () => {
    setBusy(true);
    setActionError("");

    try {
      await memberSubmissions.approve(selectedId(), overrides);

      closeDetail();
      reload();
    } catch (caught) {
      setActionError(caught?.message ?? "La validation a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setActionError("");

    try {
      await memberSubmissions.reject(selectedId(), rejectReason);

      closeDetail();
      reload();
    } catch (caught) {
      setActionError(caught?.message ?? "Le rejet a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const isUpdate = detail?.submission.type === "update";

  const rows = detail
    ? isUpdate && detail.currentMember
      ? diffFields(
          detail.currentMember,
          detail.submission.data,
          flockNames,
          churchNames
        )
      : Object.keys(FIELD_LABELS).map((field) => ({
          field,
          label: FIELD_LABELS[field],
          before: null,
          after: formatValue(
            field,
            detail.submission.data[field],
            flockNames,
            churchNames
          ),
        }))
    : [];

  return (
    <section className="submissions-panel">
      <header className="submissions-panel__header">
        <div>
          <h1>Inscriptions en attente</h1>

          <p>
            Demandes envoyées depuis le site public. Rien n&apos;est
            enregistré dans l&apos;annuaire des membres tant
            qu&apos;une demande n&apos;est pas validée ici.
          </p>
        </div>
      </header>

      <div aria-busy={loading}>
        {loading && <AdminLoading label="Chargement des demandes…" />}

        {!loading && error && (
          <AdminError message={error} onRetry={reload} />
        )}

        {!loading && !error && items.length === 0 && (
          <AdminEmpty message="Aucune demande en attente pour le moment." />
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="submissions-panel__list">
            {items.map((submission) => (
              <li key={submission.id ?? submission._id}>
                <span className="submissions-panel__kind">
                  {KIND_LABELS[submission.type] ?? submission.type}
                </span>

                <span className="submissions-panel__name">
                  {submission.data?.firstName} {submission.data?.lastName}
                  {submission.submittedRegistrationNumber &&
                    ` — ${submission.submittedRegistrationNumber}`}
                </span>

                <button
                  type="button"
                  onClick={() => openDetail(submission)}
                >
                  Examiner
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <AdminModal title="Revue de la demande" onClose={closeDetail}>
          {!detail && !detailError && <AdminLoading label="Chargement…" />}

          {detailError && (
            <p className="submissions-panel__alert" role="alert">
              {detailError}
            </p>
          )}

          {detail && (
            <>
              <table className="submissions-panel__diff">
                <thead>
                  <tr>
                    <th>Champ</th>
                    {isUpdate && <th>Avant</th>}
                    <th>{isUpdate ? "Après" : "Valeur soumise"}</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.field}>
                      <td>{row.label}</td>
                      {isUpdate && <td>{row.before}</td>}
                      <td>{row.after}</td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isUpdate ? 3 : 2}>
                        Aucune différence avec la fiche actuelle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="submissions-panel__overrides">
                <p>Corriger si nécessaire avant de valider :</p>

                {EDITABLE_FIELDS.map((field) => (
                  <label key={field}>
                    {FIELD_LABELS[field]}
                    <input
                      type="text"
                      value={
                        overrides[field] ??
                        detail.submission.data[field] ??
                        ""
                      }
                      onChange={(event) =>
                        setOverrides((previous) => ({
                          ...previous,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              {actionError && (
                <p className="submissions-panel__alert" role="alert">
                  {actionError}
                </p>
              )}

              {rejecting ? (
                <div className="submissions-panel__reject">
                  <label htmlFor="submission-reject-reason">
                    Motif du rejet (interne)
                  </label>

                  <textarea
                    id="submission-reject-reason"
                    rows={3}
                    value={rejectReason}
                    onChange={(event) =>
                      setRejectReason(event.target.value)
                    }
                  />

                  <div className="submissions-panel__actions">
                    <button
                      type="button"
                      className="submissions-panel__ghost"
                      onClick={() => setRejecting(false)}
                      disabled={busy}
                    >
                      Annuler
                    </button>

                    <button
                      type="button"
                      className="submissions-panel__danger"
                      onClick={handleReject}
                      disabled={busy}
                    >
                      {busy ? "Envoi…" : "Confirmer le rejet"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="submissions-panel__actions">
                  <button
                    type="button"
                    className="submissions-panel__danger"
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                  >
                    <XCircle aria-hidden="true" />
                    Rejeter
                  </button>

                  <button
                    type="button"
                    className="submissions-panel__approve"
                    onClick={handleApprove}
                    disabled={busy}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    {busy ? "Validation…" : "Valider"}
                  </button>
                </div>
              )}
            </>
          )}
        </AdminModal>
      )}
    </section>
  );
};

export default SubmissionsPanel;
