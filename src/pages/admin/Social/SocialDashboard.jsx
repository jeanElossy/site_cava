import { useCallback, useState } from "react";

import {
  AlertTriangle,
  Banknote,
  Gift,
  HandHeart,
  Landmark,
  Percent,
  UserCheck,
  Users,
} from "lucide-react";

import { fetchSocialDashboard } from "../../../services/social";

import useAsyncData from "../../../hooks/useAsyncData";
import usePageMeta from "../../../hooks/usePageMeta";

import {
  AdminEmpty,
  AdminError,
  AdminLoading,
} from "../../../components/admin/AdminFeedback";

import { money, useChurchOptions } from "./socialShared";

import "./SocialDashboard.scss";

const SocialDashboard = () => {
  usePageMeta({
    title: "Service Social — Tableau de bord",
    description:
      "Vue d'ensemble des offrandes sociales et de la caisse de solidarité du Centre Apostolique Vie et Abondance.",
  });

  const [church, setChurch] = useState("");

  const { options: churchOptions } = useChurchOptions();

  const load = useCallback(
    () => fetchSocialDashboard(church ? { church } : {}),
    [church]
  );

  const { data, loading, error, reload } = useAsyncData(load);

  return (
    <div className="admin-social-dashboard">
      <header className="admin-social-dashboard__header">
        <div>
          <h1>Service Social</h1>
          <p>Offrandes sociales mensuelles et caisse de solidarité.</p>
        </div>

        <label className="admin-social-dashboard__church-select">
          <span>Église</span>
          <select value={church} onChange={(event) => setChurch(event.target.value)}>
            <option value="">Toutes les églises</option>
            {churchOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading && <AdminLoading />}
      {error && <AdminError message={error} onRetry={reload} />}

      {!loading && !error && !data && (
        <AdminEmpty message="Aucune donnée disponible pour l'instant." />
      )}

      {!loading && !error && data && (
        <ul className="admin-social-dashboard__stats">
          <li className="admin-social-dashboard__stat">
            <Users aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">Membres actifs</span>
            <strong>{data.activeMembers ?? 0}</strong>
          </li>

          <li className="admin-social-dashboard__stat">
            <UserCheck aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">
              Offrandes du mois
            </span>
            <strong>
              {data.contributionsThisMonth?.paidCount ?? 0} /{" "}
              {data.contributionsThisMonth?.totalMembers ?? 0}
            </strong>
            <span className="admin-social-dashboard__stat-hint">membres à jour</span>
          </li>

          <li className="admin-social-dashboard__stat admin-social-dashboard__stat--accent">
            <Banknote aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">
              Montant collecté ce mois
            </span>
            <strong>{money(data.amountCollectedThisMonth)}</strong>
          </li>

          <li className="admin-social-dashboard__stat admin-social-dashboard__stat--warning">
            <AlertTriangle aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">
              Offrandes en retard
            </span>
            <strong>{data.lateContributions ?? 0}</strong>
          </li>

          <li className="admin-social-dashboard__stat admin-social-dashboard__stat--accent">
            <Landmark aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">Caisse sociale</span>
            <strong>{money(data.cashBalance)}</strong>
            <span className="admin-social-dashboard__stat-hint">solde actuel</span>
          </li>

          <li className="admin-social-dashboard__stat admin-social-dashboard__stat--accent">
            <Gift aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">
              Aides sociales du mois
            </span>
            <strong>{money(data.aidAmountThisMonth ?? 0)}</strong>
          </li>

          <li className="admin-social-dashboard__stat">
            <HandHeart aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">
              Nombre d&apos;aides
            </span>
            <strong>{data.aidCount ?? 0}</strong>
          </li>

          <li className="admin-social-dashboard__stat">
            <Percent aria-hidden="true" />
            <span className="admin-social-dashboard__stat-label">
              Taux d&apos;offrande
            </span>
            <strong>{data.paymentRate ?? 0}%</strong>
          </li>
        </ul>
      )}
    </div>
  );
};

export default SocialDashboard;
