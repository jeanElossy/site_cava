import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Heart, Share2, UserPlus } from "lucide-react";

import {
  listPresenceVisitors,
  downloadSessionAttendancePdf,
  downloadVisitorsPdf,
} from "../../../services/presences";
import { newSouls } from "../../../services/api";

import "./VisitorsPanel.scss";

const canShareFiles = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function";

// Liste des visiteurs enregistrés pendant CE service (voir
// `mark-visitor`), avec deux actions : exporter/partager un PDF
// portant uniquement leurs noms & prénoms, et amorcer le dossier SOA
// de l'un d'eux (nom/prénom déjà posés, voir newSoul.service.js).
//
// "Enregistrer via SOA" n'ouvre plus le formulaire ici : c'est une
// porte d'entrée vers /admin/connexion (voir RequireAuth.jsx et
// Login.jsx, qui gèrent déjà `state.from`) — l'agent de badgeage n'est
// pas forcément l'agent SOA qui traitera le dossier, celui-ci doit se
// connecter avec SON PROPRE compte pour le reprendre et "commencer le
// suivi". Voir newSoul.service.js#isSoaUser : un compte SOA voit tous
// les dossiers non transmis, pas seulement ceux qu'il a créés.
const VisitorsPanel = ({ sessionToken }) => {
  const navigate = useNavigate();

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await listPresenceVisitors(sessionToken);
      setVisitors(data);
    } catch {
      /* la liste reste celle déjà affichée */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = setTimeout(load, 0);
    const interval = setInterval(load, 15000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  // `fetcher` explicite : les deux boutons ne produisent PAS le même
  // document. Télécharger donne la feuille de présence complète —
  // membres scannés et visiteurs, avec les totaux — que l'agent
  // archive ; partager envoie la seule liste des visiteurs, destinée à
  // l'équipe des nouvelles âmes.
  const withPdf = async (action, fetcher, task) => {
    setBusy(action);
    setError("");

    try {
      const { blob, filename } = await fetcher(sessionToken);

      await task(blob, filename);
    } catch (caught) {
      if (caught?.name !== "AbortError") {
        setError(caught?.message ?? "Le PDF n'a pas pu être généré.");
      }
    } finally {
      setBusy("");
    }
  };

  const download = () =>
    withPdf("download", downloadSessionAttendancePdf, (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    });

  const share = () =>
    withPdf("share", downloadVisitorsPdf, async (blob, filename) => {
      const file = new File([blob], filename, { type: "application/pdf" });

      if (!navigator.canShare({ files: [file] })) {
        throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
      }

      await navigator.share({ files: [file], title: "Liste des visiteurs" });
    });

  const startSoaDossier = async (visitor) => {
    setError("");

    try {
      const created = await newSouls.create(
        { firstName: visitor.firstName, lastName: visitor.lastName },
        sessionToken
      );

      navigate("/admin/connexion", {
        state: { from: `/admin/nouvelles-ames/${created.id}` },
      });
    } catch (caught) {
      setError(caught?.message ?? "Impossible de démarrer ce dossier.");
    }
  };

  return (
    <section className="visitors-panel">
      <header className="visitors-panel__header">
        <h3>
          <UserPlus aria-hidden="true" />
          Visiteurs de ce service ({visitors.length})
        </h3>

        <div className="visitors-panel__actions">
          <button type="button" onClick={download} disabled={busy !== ""}>
            <FileText aria-hidden="true" />
            {busy === "download" ? "Préparation…" : "Télécharger le PDF"}
          </button>

          {canShareFiles() && (
            <button type="button" onClick={share} disabled={busy !== ""}>
              <Share2 aria-hidden="true" />
              {busy === "share" ? "Préparation…" : "Partager"}
            </button>
          )}
        </div>
      </header>

      {error && <p className="visitors-panel__error">{error}</p>}

      {!loading && visitors.length === 0 && (
        <p className="visitors-panel__empty">Aucun visiteur enregistré pour l'instant.</p>
      )}

      {visitors.length > 0 && (
        <ul className="visitors-panel__list">
          {visitors.map((visitor) => (
            <li key={visitor.id}>
              <span>
                {visitor.lastName} {visitor.firstName}
              </span>
              {visitor.isBadge ? (
                // Badge invité pré-imprimé : identité fictive
                // ("Invité Homme 1"), utile pour le seul comptage.
                // Aucun dossier SOA n'a de sens tant que la personne
                // n'a pas été enregistrée sous son vrai nom (voir
                // le bouton "Ajouter un visiteur (sans carte)").
                <span className="visitors-panel__badge-tag">Badge invité</span>
              ) : (
                <button type="button" onClick={() => startSoaDossier(visitor)}>
                  <Heart aria-hidden="true" />
                  Enregistrer via SOA
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default VisitorsPanel;
