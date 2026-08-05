import { useState } from "react";

import { newSouls } from "../../../services/api";
import StepperShell from "../shared/StepperShell";
import { useAutoSave } from "../shared/useAutoSave";

import StepDossier from "./StepDossier";
import StepPersonal from "./StepPersonal";
import StepContact from "./StepContact";
import StepFirstContact from "./StepFirstContact";
import StepSpiritual from "./StepSpiritual";
import StepNeeds from "./StepNeeds";
import StepConsent from "./StepConsent";
import StepTransmission from "./StepTransmission";

const STEPS = [
  { id: "dossier", label: "Dossier", Component: StepDossier },
  { id: "personal", label: "Informations personnelles", Component: StepPersonal },
  { id: "contact", label: "Contact", Component: StepContact },
  { id: "first-contact", label: "Premier contact", Component: StepFirstContact },
  { id: "spiritual", label: "Situation spirituelle", Component: StepSpiritual },
  { id: "needs", label: "Besoins", Component: StepNeeds },
  { id: "consent", label: "Consentement", Component: StepConsent },
  { id: "transmission", label: "Transmission", Component: StepTransmission },
];

// Wizard d'enregistrement SOA (§A à §G de la fiche officielle). Gère
// son propre état local + sauvegarde automatique ; ne connaît rien de
// la CANA — c'est `NewSoulDetailPage` qui bascule vers `CANAWizard`
// une fois le dossier transmis.
//
// `sessionToken` (optionnel) : présent quand ce wizard est ouvert
// depuis l'écran de scan des présences par un agent de service
// d'ordre (jeton de session de badgeage, pas le jeton admin de
// `localStorage`) — voir PresenceScanner.jsx. Omis dans le contexte
// admin habituel.
const SOAWizard = ({ newSoul, onTransmitted, sessionToken }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState(newSoul.soa ?? {});

  const disabled = Boolean(newSoul.soa?.lockedAt);

  const saveState = useAutoSave(
    data,
    (next) => newSouls.updateSoa(newSoul.id, next, sessionToken),
    { delay: 900 }
  );

  const patch = (fields) => setData((current) => ({ ...current, ...fields }));

  const handleTransmit = async () => {
    const updated = await newSouls.transmit(newSoul.id, sessionToken);
    onTransmitted(updated);
  };

  const { Component } = STEPS[activeIndex];

  return (
    <StepperShell
      steps={STEPS}
      activeIndex={activeIndex}
      onStepChange={setActiveIndex}
      saveState={disabled ? "idle" : saveState}
    >
      <Component
        data={data}
        onChange={patch}
        disabled={disabled}
        caseNumber={newSoul.caseNumber}
        agentName={newSoul.soa?.agentName}
        onTransmit={handleTransmit}
      />
    </StepperShell>
  );
};

export default SOAWizard;
