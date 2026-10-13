import { describe, expect, it } from "vitest";

import { IDLE_LIMIT_MS, IDLE_WARNING_MS, idleState } from "./useIdleTimeout";

describe("idleState", () => {
  const start = 1_000_000;

  it("reste actif avant la dernière minute", () => {
    expect(idleState(start + 10 * 60 * 1000, start).phase).toBe("active");
  });

  it("prévient pendant la dernière minute, avec le compte à rebours", () => {
    const now = start + IDLE_LIMIT_MS - IDLE_WARNING_MS + 15_000;

    expect(idleState(now, start)).toEqual({ phase: "warning", secondsLeft: 45 });
  });

  it("expire à l'échéance exacte", () => {
    expect(idleState(start + IDLE_LIMIT_MS, start)).toEqual({
      phase: "expired",
      secondsLeft: 0,
    });
  });

  it("une activité récente dans un AUTRE onglet repousse l'échéance", () => {
    // `useIdleTimeout` passe le plus récent des deux horodatages
    // (onglet, stockage partagé) : c'est ce maximum qui est évalué.
    const otherTab = start + IDLE_LIMIT_MS - 1000;
    const now = start + IDLE_LIMIT_MS + 5000;

    expect(idleState(now, Math.max(start, otherTab)).phase).toBe("active");
  });
});
