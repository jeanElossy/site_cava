import { useEffect, useRef, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  QrCode,
  Search,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from "lucide-react";

import {
  markPresenceManually,
  markVisitorPresence,
  presenceStats,
  scanMemberCard,
  searchPresenceMembers,
} from "../../services/presences";
import { extractQrParam } from "../../utils/qrLink";

import QrCameraScanner from "../../components/presence/QrCameraScanner/QrCameraScanner";
import ThemeToggle from "../../components/presence/ThemeToggle/ThemeToggle";

// Rôles habilités au badgeage (voir presenceAuth.js#PRESENCE_AGENT_ROLES
// côté serveur) — libellés propres à cet écran plutôt qu'un import
// depuis l'administration, pour ne pas faire dépendre le bundle public
// du bundle admin (voir AdminRoutes.jsx).
const AGENT_ROLE_LABELS = {
  serviteur: "Serviteur",
  responsable: "Responsable",
  pasteur: "Pasteur",
  chantre: "Chantre",
  dirigeant: "Dirigeant",
};

// Pause après un scan (réussi ou en échec) avant que la caméra ne
// reprenne — laisse le temps de lire la confirmation à l'écran, tout
// en empêchant de soumettre la même carte plusieurs fois de suite si
// elle reste dans le cadre.
const RESUME_DELAY_MS = 1800;

// Confirmation sonore courte, générée plutôt que chargée depuis un
// fichier : aucune dépendance, aucune requête externe (CSP stricte du
// site — voir vercel.json).
const playConfirmationBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    /* Audio indisponible (autoplay bloqué, navigateur non supporté) —
       la confirmation visuelle suffit. */
  }
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatDateTime = (date) =>
  new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const PresenceScanner = ({
  session,
  theme,
  onToggleTheme,
  onLogout,
  onSessionRejected,
}) => {
  const { sessionToken, agent, qr } = session;

  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [counts, setCounts] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [visitorFormOpen, setVisitorFormOpen] = useState(false);
  const [visitorFirstName, setVisitorFirstName] = useState("");
  const [visitorLastName, setVisitorLastName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");

  const resumeTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    presenceStats(sessionToken)
      .then(
        (data) =>
          mountedRef.current &&
          setCounts({
            total: data.total,
            members: data.members,
            visitors: data.visitors,
          })
      )
      .catch((error) => {
        if (error?.status === 401) onSessionRejected();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const applyResult = (result, kind) => {
    if (!mountedRef.current) return;

    setLastResult({ ...result, kind });
    setLastError(null);

    if (!result.alreadyRecorded) {
      setCounts((previous) => {
        if (!previous) return previous;

        const key = kind === "visitor" ? "visitors" : "members";

        return {
          ...previous,
          total: previous.total + 1,
          [key]: previous[key] + 1,
        };
      });
    }

    playConfirmationBeep();
  };

  const applyError = (error) => {
    if (error?.status === 401) {
      onSessionRejected();
      return;
    }

    if (!mountedRef.current) return;

    setLastError(error?.message ?? "Le badgeage a échoué.");
    setLastResult(null);
  };

  const scheduleResume = () => {
    resumeTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setScanning(true);
    }, RESUME_DELAY_MS);
  };

  const handleDecode = async (decoded) => {
    if (busy) return;

    setScanning(false);
    setBusy(true);

    const registrationNumber = extractQrParam(decoded, "matricule");

    try {
      const result = await scanMemberCard(registrationNumber, sessionToken);
      applyResult(result, "member");
    } catch (error) {
      applyError(error);
    } finally {
      if (mountedRef.current) setBusy(false);
      scheduleResume();
    }
  };

  // Recherche « carte oubliée », avec un léger anti-rebond : chaque
  // frappe ne doit pas déclencher un appel réseau immédiat.
  useEffect(() => {
    if (!searchOpen || !query.trim()) return undefined;

    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const found = await searchPresenceMembers(query.trim(), sessionToken);
        if (mountedRef.current) setResults(found);
      } catch (error) {
        if (error?.status === 401) onSessionRejected();
      } finally {
        if (mountedRef.current) setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchOpen]);

  const handleMark = async (memberId) => {
    if (busy) return;

    setBusy(true);
    setSearchOpen(false);
    setQuery("");
    setResults([]);

    try {
      const result = await markPresenceManually(memberId, sessionToken);
      applyResult(result, "member");
    } catch (error) {
      applyError(error);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleAddVisitor = async (event) => {
    event.preventDefault();

    if (busy || !visitorFirstName.trim() || !visitorLastName.trim()) return;

    setBusy(true);

    try {
      const result = await markVisitorPresence(
        {
          firstName: visitorFirstName.trim(),
          lastName: visitorLastName.trim(),
          phone: visitorPhone.trim() || undefined,
        },
        sessionToken
      );

      applyResult(result, "visitor");
      setVisitorFormOpen(false);
      setVisitorFirstName("");
      setVisitorLastName("");
      setVisitorPhone("");
    } catch (error) {
      applyError(error);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const remainingMs = new Date(qr.validUntil).getTime() - now.getTime();
  const isEndingSoon = remainingMs > 0 && remainingMs < 10 * 60 * 1000;

  const remaining =
    remainingMs > 0
      ? new Date(remainingMs).toISOString().substring(11, 19)
      : "00:00:00";

  return (
    <div className="presence-scanner">
      <ThemeToggle
        theme={theme}
        onToggle={onToggleTheme}
      />

      <header className="presence-scanner__header">
        <div className="presence-scanner__title">
          <span
            className="presence-scanner__title-icon"
            aria-hidden="true"
          >
            <QrCode />
          </span>

          <div>
            <h1>BADGEAGE DES MEMBRES</h1>
            <p>
              {qr.label}
              <span className="presence-scanner__status-dot" aria-hidden="true" />
              En cours
            </p>
          </div>
        </div>

        <div
          className={`presence-scanner__countdown${
            isEndingSoon ? " presence-scanner__countdown--warning" : ""
          }`}
        >
          <span>Fin de validité</span>
          <strong>{remaining}</strong>
          <em>{formatDateTime(qr.validUntil)}</em>
        </div>
      </header>

      <div className="presence-scanner__session-bar">
        <span className="presence-scanner__connected">
          <CheckCircle2 aria-hidden="true" />
          Connecté
        </span>
        <span>
          Agent : <strong>{agent.registrationNumber}</strong>
        </span>
        <span>
          Rôle : <strong>{AGENT_ROLE_LABELS[agent.role] ?? agent.role}</strong>
        </span>
      </div>

      <div className="presence-scanner__grid">
        <section className="presence-scanner__scan-panel">
          <h2>
            <QrCode aria-hidden="true" />
            Scanner la carte du membre
          </h2>
          <p>Placez le QR code de la carte dans le cadre</p>

          <QrCameraScanner
            active={scanning && !busy}
            onDecode={handleDecode}
            hint="Approchez la carte du lecteur pour un scan plus rapide."
          />

          <div className="presence-scanner__divider">
            <span>OU</span>
          </div>

          <div className="presence-scanner__search">
            <label htmlFor="presence-search">
              <Search aria-hidden="true" />
              Rechercher un membre
            </label>

            <div className="presence-scanner__search-row">
              <input
                id="presence-search"
                type="text"
                value={query}
                onChange={(event) => {
                  const value = event.target.value;

                  setQuery(value);
                  setSearchOpen(true);
                  if (!value.trim()) setResults([]);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Matricule, nom, prénom ou téléphone…"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Rechercher"
              >
                <Search aria-hidden="true" />
              </button>
            </div>

            {searchOpen && query.trim() && (
              <ul className="presence-scanner__results">
                {searching && <li className="presence-scanner__results-empty">Recherche…</li>}

                {!searching && results.length === 0 && (
                  <li className="presence-scanner__results-empty">Aucun membre trouvé.</li>
                )}

                {!searching &&
                  results.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => handleMark(member.id)}
                        disabled={busy}
                      >
                        <User aria-hidden="true" />
                        <span>
                          <strong>
                            {member.firstName} {member.lastName}
                          </strong>
                          <em>{member.registrationNumber}</em>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}

            {!visitorFormOpen ? (
              <button
                type="button"
                className="presence-scanner__add-visitor"
                onClick={() => setVisitorFormOpen(true)}
              >
                <UserPlus aria-hidden="true" />
                Ajouter un visiteur (sans carte)
              </button>
            ) : (
              <form
                className="presence-scanner__visitor-form"
                onSubmit={handleAddVisitor}
              >
                <input
                  type="text"
                  value={visitorFirstName}
                  onChange={(event) => setVisitorFirstName(event.target.value)}
                  placeholder="Prénom du visiteur"
                  disabled={busy}
                  autoFocus
                />
                <input
                  type="text"
                  value={visitorLastName}
                  onChange={(event) => setVisitorLastName(event.target.value)}
                  placeholder="Nom du visiteur"
                  disabled={busy}
                />
                <input
                  type="tel"
                  value={visitorPhone}
                  onChange={(event) => setVisitorPhone(event.target.value)}
                  placeholder="Téléphone (facultatif)"
                  disabled={busy}
                />

                <div className="presence-scanner__visitor-form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setVisitorFormOpen(false);
                      setVisitorFirstName("");
                      setVisitorLastName("");
                      setVisitorPhone("");
                    }}
                    disabled={busy}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !visitorFirstName.trim() || !visitorLastName.trim()}
                  >
                    Enregistrer la présence
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        <aside className="presence-scanner__result-panel">
          <h2>
            <User aria-hidden="true" />
            Dernière présence enregistrée
          </h2>

          {lastError && (
            <div
              className="presence-scanner__feedback presence-scanner__feedback--error"
              role="alert"
            >
              <AlertCircle aria-hidden="true" />
              <strong>{lastError}</strong>
            </div>
          )}

          {lastResult && (
            <div
              className="presence-scanner__feedback presence-scanner__feedback--success"
              role="status"
            >
              <CheckCircle2 aria-hidden="true" />
              <strong>
                {lastResult.alreadyRecorded
                  ? "Déjà enregistrée"
                  : "Présence enregistrée !"}
              </strong>
              <span>{formatTime(lastResult.recordedAt)}</span>
            </div>
          )}

          {lastResult?.kind === "member" && lastResult.member && (
            <div className="presence-scanner__member">
              {lastResult.member.photo ? (
                <img
                  src={lastResult.member.photo}
                  alt=""
                />
              ) : (
                <span className="presence-scanner__member-initials">
                  {lastResult.member.firstName?.[0]}
                  {lastResult.member.lastName?.[0]}
                </span>
              )}

              <div>
                <strong>
                  {lastResult.member.firstName} {lastResult.member.lastName}
                </strong>

                <span>Matricule</span>
                <p>{lastResult.member.registrationNumber}</p>

                {lastResult.member.area && (
                  <>
                    <span>Quartier</span>
                    <p>{lastResult.member.area}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {lastResult?.kind === "visitor" && lastResult.visitor && (
            <div className="presence-scanner__member">
              <span className="presence-scanner__member-initials">
                {lastResult.visitor.firstName?.[0]}
                {lastResult.visitor.lastName?.[0]}
              </span>

              <div>
                <strong>
                  {lastResult.visitor.firstName} {lastResult.visitor.lastName}
                </strong>

                <span>Visiteur</span>
                <p>{lastResult.visitor.phone || "Téléphone non renseigné"}</p>
              </div>
            </div>
          )}

          {!lastResult && !lastError && (
            <p className="presence-scanner__result-placeholder">
              Scannez une carte pour voir apparaître la présence ici.
            </p>
          )}
        </aside>
      </div>

      <div className="presence-scanner__stats">
        <div className="presence-scanner__stat">
          <Users aria-hidden="true" />
          <strong>{counts?.total ?? "—"}</strong>
          <span>Présents</span>
        </div>

        <div className="presence-scanner__stat">
          <UserPlus aria-hidden="true" />
          <strong>{counts?.visitors ?? "—"}</strong>
          <span>Visiteurs</span>
        </div>

        <div className="presence-scanner__stat">
          <Clock aria-hidden="true" />
          <strong>{formatTime(qr.validFrom ?? qr.validUntil)}</strong>
          <span>Début du service</span>
        </div>

        <div className="presence-scanner__stat">
          <ShieldCheck aria-hidden="true" />
          <strong>{AGENT_ROLE_LABELS[agent.role] ?? agent.role}</strong>
          <span>Agent connecté</span>
        </div>
      </div>

      <div className="presence-scanner__footer">
        <button
          type="button"
          className="presence-scanner__logout"
          onClick={onLogout}
        >
          <LogOut aria-hidden="true" />
          Déconnexion
        </button>

        <button
          type="button"
          className="presence-scanner__next"
          onClick={() => {
            setLastResult(null);
            setLastError(null);
            setScanning(true);
          }}
          disabled={scanning || busy}
        >
          <QrCode aria-hidden="true" />
          Scanner suivant
        </button>
      </div>
    </div>
  );
};

export default PresenceScanner;
