import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Heart, Share2, UserPlus, UserCheck } from "lucide-react";

import {
  identifyPresenceVisitor,
  listPresenceVisitors,
  downloadSessionAttendancePdf,
  downloadVisitorsPdf,
} from "../../../services/presences";
import { newSouls } from "../../../services/api";
import GuestIdentityForm from "../GuestIdentityForm/GuestIdentityForm";

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
const VisitorsPanel = ({ sessionToken, serviceLabel, refreshKey = 0 }) => {
  const navigate = useNavigate();

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Rattrapage : badge dont l'agent a passé l'identification au scan
  // (« Plus tard »), ou dont le nom est à corriger. Un seul à la fois —
  // le formulaire s'ouvre dans la ligne concernée.
  const [identifying, setIdentifying] = useState(null);
  const [identifyBusy, setIdentifyBusy] = useState(false);
  const [identifyError, setIdentifyError] = useState("");

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
    // 60 s et non 15 : chaque appareil connecté sonde cette liste en
    // permanence, et tous partagent le quota de l'unique IP publique du
    // wifi de l'église (voir la limite côté serveur). Un rafraîchissement
    // toutes les 15 s multipliait ce trafic de fond par quatre sans
    // bénéfice — la liste des visiteurs se consulte épisodiquement, pas
    // en continu. Une identification faite au scanner rafraîchit déjà la
    // liste tout de suite via `refreshKey`.
    const interval = setInterval(load, 60000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
    // `refreshKey` : le scanner l'incrémente dès qu'il vient
    // d'identifier un badge, pour que la liste montre le vrai nom tout
    // de suite plutôt qu'au prochain tour de sondage (15 s).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, refreshKey]);

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

  const identify = async (visitor, identity) => {
    setIdentifyBusy(true);
    setIdentifyError("");

    try {
      await identifyPresenceVisitor(visitor.id, identity, sessionToken);

      setIdentifying(null);
      await load();
    } catch (caught) {
      setIdentifyError(caught?.message ?? "L'identité n'a pas pu être enregistrée.");
    } finally {
      setIdentifyBusy(false);
    }
  };

  // Le dossier SOA part avec TOUT ce que l'agent a déjà saisi à
  // l'accueil — identité, téléphone, genre (déduit du badge scanné) et
  // service en cours. C'est le sens de la saisie au badgeage : l'agent
  // SOA reprend un dossier déjà amorcé au lieu de redemander à la
  // personne ce qu'elle a déjà donné. Les clés correspondent à celles
  // de la section `soa` (voir backend/src/models/NewSoul.js) ; Mongoose
  // ignore ce qu'il ne connaît pas, rien d'autre ne transite.
  const startSoaDossier = async (visitor) => {
    setError("");

    try {
      const created = await newSouls.create(
        {
          firstName: visitor.firstName,
          lastName: visitor.lastName,
          phone: visitor.phone,
          gender: visitor.gender,
          service: serviceLabel,
        },
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
              <div className="visitors-panel__row">
                <span>
                  {visitor.lastName} {visitor.firstName}
                </span>

                <div className="visitors-panel__row-actions">
                  {/* Conservé même une fois la personne identifiée :
                      c'est ce qu'elle porte au cou, et le même libellé
                      que sur la feuille de présence. */}
                  {visitor.isBadge && (
                    <span className="visitors-panel__badge-tag">Badge invité</span>
                  )}

                  {visitor.identified ? (
                    <button type="button" onClick={() => startSoaDossier(visitor)}>
                      <Heart aria-hidden="true" />
                      Enregistrer via SOA
                    </button>
                  ) : (
                    // Badge scanné mais jamais nommé (identification
                    // passée au moment du scan) : il ne porte qu'une
                    // identité fictive, aucun dossier SOA n'aurait de
                    // sens dessus. Rattrapage possible tant que le
                    // service dure.
                    <button
                      type="button"
                      onClick={() => {
                        setIdentifying(visitor.id);
                        setIdentifyError("");
                      }}
                    >
                      <UserCheck aria-hidden="true" />
                      Identifier
                    </button>
                  )}
                </div>
              </div>

              {identifying === visitor.id && (
                <GuestIdentityForm
                  busy={identifyBusy}
                  error={identifyError}
                  cancelLabel="Annuler"
                  onSubmit={(identity) => identify(visitor, identity)}
                  onCancel={() => setIdentifying(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default VisitorsPanel;
