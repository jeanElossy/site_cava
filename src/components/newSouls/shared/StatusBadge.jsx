import { STATUS_LABELS, STATUS_TONES } from "./statusLabels";

import "./NewSouls.scss";

const StatusBadge = ({ status }) => (
  <span className={`status-badge status-badge--${STATUS_TONES[status] ?? "neutral"}`}>
    {STATUS_LABELS[status] ?? status}
  </span>
);

export default StatusBadge;
