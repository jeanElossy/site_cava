import { useCallback } from "react";

import { Link } from "react-router-dom";

import {
  Baby,
  CalendarCheck,
  GraduationCap,
  TrendingUp,
  UserCheck,
} from "lucide-react";

import ChildrenPage, {
  ChildrenPanel,
  ChildrenStat,
} from "../../../components/children/ChildrenPage";

import ChildrenDonut from "../../../components/children/ChildrenChart/ChildrenDonut";
import ChildrenBars from "../../../components/children/ChildrenChart/ChildrenBars";

import {
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import useAsyncData from "../../../hooks/useAsyncData";

import { childrenDashboard } from "../../../services/children";

import "./Children.scss";

/**
 * Tableau de bord du module Enfants.
 *
 * Tous les chiffres viennent d'UNE seule requête : la page en affiche
 * une dizaine, et les demander séparément ferait autant d'allers-retours
 * pour l'écran qu'on ouvre en premier chaque matin.
 */
const ChildrenDashboard = () => {
  const load = useCallback(() => childrenDashboard(), []);

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

  const classes = data?.classes ?? [];

  // Les classes sont déjà triées par âge côté API (`ageMin`, puis nom).
  // L'index sert de couleur : la rampe verte va donc des plus petits
  // aux plus grands, et une classe garde sa teinte quel que soit le
  // graphique où elle apparaît.
  const slices = classes.map((item, index) => ({
    key: item.id,
    label: item.name,
    value: item.childCount,
    colorIndex: index,
  }));

  const monitorCount = classes.reduce(
    (total, item) => total + (item.monitors?.length ?? 0),
    0
  );

  const childCount = data?.childCount ?? 0;

  const withoutMonitor = classes.filter(
    (item) => (item.monitors?.length ?? 0) === 0
  );

  const unassigned = classes.length
    ? childCount - classes.reduce((total, item) => total + item.childCount, 0)
    : 0;

  const todayStats = data?.today;

  return (
    <ChildrenPage
      title="Tableau de bord — Enfants"
      breadcrumb={[
        { label: "Administration", to: "/admin" },
        { label: "Enfants" },
      ]}
      action={
        <Link
          to="/admin/enfants/nouveau"
          className="children-button children-button--primary"
        >
          Ajouter un enfant
        </Link>
      }
      stats={
        <>
          <ChildrenStat
            icon={Baby}
            value={childCount}
            label="Enfants inscrits"
          />

          <ChildrenStat
            icon={GraduationCap}
            value={classes.length}
            label="Classes actives"
          />

          {/* « — » plutôt que « 0 » tant qu'aucun appel n'a été fait :
              un taux de 0 % un lundi matin serait un contresens. */}
          <ChildrenStat
            icon={CalendarCheck}
            value={
              todayStats?.rate === null || todayStats?.rate === undefined
                ? "—"
                : `${todayStats.rate} %`
            }
            label="Présence aujourd'hui"
            hint={
              todayStats?.sessionCount
                ? `${todayStats.present} présents sur ${todayStats.expected}`
                : "Aucun appel fait aujourd'hui"
            }
            tone="success"
          />

          <ChildrenStat
            icon={UserCheck}
            value={monitorCount}
            label="Moniteurs affectés"
            hint={
              withoutMonitor.length > 0
                ? `${withoutMonitor.length} classe(s) sans moniteur`
                : undefined
            }
            tone={withoutMonitor.length > 0 ? "warning" : "neutral"}
          />

          {unassigned > 0 && (
            <ChildrenStat
              icon={TrendingUp}
              value={unassigned}
              label="Enfants sans classe"
              tone="warning"
            />
          )}
        </>
      }
      aside={
        <>
          {withoutMonitor.length > 0 && (
            <ChildrenPanel title="À traiter">
              <ul className="children-alerts">
                {withoutMonitor.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong>
                    <span>n&apos;a aucun moniteur affecté</span>
                  </li>
                ))}
              </ul>
            </ChildrenPanel>
          )}

          <ChildrenPanel title="Accès rapides">
            <ul className="children-links">
              <li>
                <Link to="/admin/enfants/liste">Voir tous les enfants</Link>
              </li>
              <li>
                <Link to="/admin/enfants/classes">Gérer les classes</Link>
              </li>
              <li>
                <Link to="/admin/enfants/moniteurs">Moniteurs et accès</Link>
              </li>
              <li>
                <Link to="/admin/enfants/remplacements">Remplacements</Link>
              </li>
            </ul>
          </ChildrenPanel>
        </>
      }
    >
      {classes.length === 0 ? (
        <p className="children-empty-card">
          Aucune classe pour le moment.{" "}
          <Link to="/admin/enfants/classes">Créez la première classe</Link> pour
          commencer à inscrire des enfants.
        </p>
      ) : (
        <div className="children-charts">
          <ChildrenDonut
            title="Répartition des enfants par classe"
            total={childCount}
            totalLabel="Enfants"
            slices={slices}
          />

          {/* Présence du jour, classe par classe.
              Seules les classes dont l'appel a été OUVERT y figurent :
              afficher 0 % pour une classe qui ne s'est pas encore
              réunie serait faux, et c'est pourquoi l'API renvoie `null`
              plutôt que zéro dans ce cas. */}
          <ChildrenBars
            title="Présence du jour, par classe"
            rows={classes
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item.attendance)
              .map(({ item, index }) => ({
                key: item.id,
                label: item.name,
                value: item.attendance.present,
                total: item.childCount,
                colorIndex: index,
              }))}
            emptyLabel="Aucun appel n'a encore été fait aujourd'hui."
          />
        </div>
      )}
    </ChildrenPage>
  );
};

export default ChildrenDashboard;
