import { useEffect, useState } from "react";

import {
  ArrowLeftRight,
  ClipboardList,
  LogOut,
  Repeat,
  Users,
} from "lucide-react";

import { monitorClasses, monitorProfile } from "../../services/monitor";

/**
 * Accueil de l'espace moniteur.
 *
 * Affiche les classes accessibles À CET INSTANT : la classe principale,
 * et les remplacements en cours aujourd'hui. Une classe remplacée dont
 * la période est passée n'apparaît tout simplement pas — ce n'est pas
 * un masquage d'interface, c'est le serveur qui ne la renvoie plus.
 */
const MonitorHome = ({ user, onOpenRollCall, onSignOut }) => {
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([monitorProfile(), monitorClasses()])
      .then(([profileData, classesData]) => {
        setProfile(profileData);
        setClasses(classesData);
      })
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  const firstName =
    profile?.monitor?.firstName ?? user?.name?.split(" ")[0] ?? "";

  const substitutions = classes.filter((item) => item.kind === "remplacement");

  return (
    <main className="monitor-home">
      <header className="monitor-home__head">
        <div>
          <p className="monitor-home__greeting">Bonjour {firstName} 👋</p>

          <p className="monitor-home__role">
            {profile?.role === "responsable_ecole_dimanche"
              ? "Responsable École du dimanche"
              : "Moniteur / Monitrice"}
          </p>
        </div>

        <button
          type="button"
          className="monitor-home__signout"
          onClick={onSignOut}
          aria-label="Se déconnecter"
        >
          <LogOut aria-hidden="true" />
        </button>
      </header>

      {error && (
        <p
          className="monitor-home__error"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && <p className="monitor-home__loading">Chargement…</p>}

      {!loading && !error && classes.length === 0 && (
        <p className="monitor-home__empty">
          Aucune classe ne vous est confiée pour le moment. Contactez le
          responsable de l&apos;École du dimanche.
        </p>
      )}

      {!loading && classes.length > 0 && (
        <section className="monitor-home__classes">
          <h2>Mes classes</h2>

          {classes.map((item) => (
            <article
              key={item.class.id ?? item.class._id}
              className={
                item.kind === "remplacement"
                  ? "monitor-class monitor-class--substitute"
                  : "monitor-class"
              }
            >
              <header>
                <span
                  className="monitor-class__icon"
                  aria-hidden="true"
                >
                  {item.class.icon || "👶"}
                </span>

                <div>
                  <h3>{item.class.name}</h3>

                  <p>
                    {item.kind === "principale" ? (
                      "Classe principale"
                    ) : (
                      <>
                        <Repeat aria-hidden="true" />
                        Remplacement
                        {item.replacedMonitor
                          ? ` — ${item.replacedMonitor.firstName} ${item.replacedMonitor.lastName}`
                          : ""}
                      </>
                    )}
                  </p>
                </div>
              </header>

              <p className="monitor-class__count">
                <Users aria-hidden="true" />
                {item.childCount} enfant{item.childCount > 1 ? "s" : ""}
              </p>

              <button
                type="button"
                className="monitor-class__action"
                onClick={() => onOpenRollCall(item)}
              >
                <ClipboardList aria-hidden="true" />
                Faire l&apos;appel
              </button>
            </article>
          ))}
        </section>
      )}

      {!loading && substitutions.length === 0 && classes.length > 0 && (
        <p className="monitor-home__note">
          <ArrowLeftRight aria-hidden="true" />
          Aucun remplacement aujourd&apos;hui.
        </p>
      )}
    </main>
  );
};

export default MonitorHome;
