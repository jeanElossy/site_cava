import { useState } from "react";
import {
  ClipboardList,
  FileText,
  Heart,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

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
  {
    id: "dossier",
    label: "Dossier",
    description: "Informations générales",
    Icon: FileText,
    Component: StepDossier,
  },
  {
    id: "personal",
    label: "Informations personnelles",
    description: "Identité & coordonnées",
    Icon: User,
    Component: StepPersonal,
  },
  {
    id: "contact",
    label: "Contact",
    description: "Moyens de contact",
    Icon: Phone,
    Component: StepContact,
  },
  {
    id: "first-contact",
    label: "Premier contact",
    description: "Circonstances",
    Icon: MessageCircle,
    Component: StepFirstContact,
  },
  {
    id: "spiritual",
    label: "Situation spirituelle",
    description: "Décision & baptême",
    Icon: Heart,
    Component: StepSpiritual,
  },
  {
    id: "needs",
    label: "Besoins",
    description: "Demandes exprimées",
    Icon: ClipboardList,
    Component: StepNeeds,
  },
  {
    id: "consent",
    label: "Consentement",
    description: "Accord & validation",
    Icon: ShieldCheck,
    Component: StepConsent,
  },
  {
    id: "transmission",
    label: "Transmission",
    description: "Vers la CANA",
    Icon: Send,
    Component: StepTransmission,
  },
];

// Bandeau décoratif rappelant les grandes étapes du parcours complet
// (au-delà du seul formulaire SOA) — purement illustratif.
const PROCESS_OVERVIEW = [
  { label: "Enregistrement\nPar le SOA", Icon: UserPlus },
  { label: "Transmission\nÀ la CANA", Icon: Send },
  { label: "Accompagnement\nPar la CANA", Icon: Users },
  { label: "Suivi 4 mois\nAccompagnement", Icon: Heart },
  { label: "Intégration\nEn bergerie", Icon: UserCheck },
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
    <div>
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

      <div className="new-soul-process">
        <p className="new-soul-process__title">Aperçu du processus</p>

        {PROCESS_OVERVIEW.map((item) => (
          <div className="new-soul-process__step" key={item.label}>
            <span className="new-soul-process__step-icon">
              <item.Icon size={18} aria-hidden="true" />
            </span>
            <span className="new-soul-process__step-label">
              {item.label.split("\n").map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SOAWizard;
