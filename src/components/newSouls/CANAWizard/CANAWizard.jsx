import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Compass,
  FileCheck,
  Flag,
  Flame,
  GraduationCap,
  HeartPulse,
  Info,
  MessageCircle,
  Users,
} from "lucide-react";

import { flocks as flocksApi, newSouls } from "../../../services/api";
import StepperShell from "../shared/StepperShell";
import { useAutoSave } from "../shared/useAutoSave";
import ReadonlySOAInfo from "./ReadonlySOAInfo";

import StepOpening from "./StepOpening";
import StepFirstContact from "./StepFirstContact";
import StepInterview from "./StepInterview";
import StepAdditionalInfo from "./StepAdditionalInfo";
import StepSpiritualDiagnosis from "./StepSpiritualDiagnosis";
import StepIntercession from "./StepIntercession";
import StepSocialTraining from "./StepSocialTraining";
import StepOrientations from "./StepOrientations";
import StepMonthlyFollowUp from "./StepMonthlyFollowUp";
import StepClosure from "./StepClosure";

const STEPS = [
  {
    id: "opening",
    label: "Ouverture",
    description: "Réception & responsable",
    Icon: FileCheck,
    Component: StepOpening,
  },
  {
    id: "first-contact",
    label: "Premier contact",
    description: "Circonstances",
    Icon: MessageCircle,
    Component: StepFirstContact,
  },
  {
    id: "interview",
    label: "Entretien",
    description: "Rencontre & écoute",
    Icon: Users,
    Component: StepInterview,
  },
  {
    id: "additional-info",
    label: "Informations complémentaires",
    description: "Compléments",
    Icon: Info,
    Component: StepAdditionalInfo,
  },
  {
    id: "spiritual",
    label: "Diagnostic spirituel",
    description: "État spirituel",
    Icon: HeartPulse,
    Component: StepSpiritualDiagnosis,
  },
  {
    id: "intercession",
    label: "Intercession & délivrance",
    description: "Prière & délivrance",
    Icon: Flame,
    Component: StepIntercession,
  },
  {
    id: "social-training",
    label: "Social, formation & disponibilité",
    description: "Cadre de vie",
    Icon: GraduationCap,
    Component: StepSocialTraining,
  },
  {
    id: "orientations",
    label: "Orientations & plan",
    description: "Bergerie & plan",
    Icon: Compass,
    Component: StepOrientations,
  },
  {
    id: "monthly",
    label: "Suivi mensuel",
    description: "Accompagnement",
    Icon: CalendarCheck,
    Component: StepMonthlyFollowUp,
  },
  {
    id: "closure",
    label: "Bilan final & clôture",
    description: "Clôture du dossier",
    Icon: Flag,
    Component: StepClosure,
  },
];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "—");

// Wizard CANA (§H à §R). Affiche d'abord les informations SOA en
// lecture seule (`ReadonlySOAInfo`), puis ses propres 10 étapes.
// Accuse réception automatiquement au montage si ce n'est pas déjà
// fait (voir newSoul.service.js#acknowledge — idempotent).
const CANAWizard = ({ newSoul, currentRole, onUpdated }) => {
  const [record, setRecord] = useState(newSoul);
  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState(newSoul.cana ?? {});
  const [coordinateurOptions, setCoordinateurOptions] = useState([]);
  const [flockOptions, setFlockOptions] = useState([]);

  const isClosed = record.status === "cloture";
  const isPasteur = currentRole === "pasteur";
  const isCoordinateur = currentRole === "coordinateur_bergeries";

  // Le coordonnateur des bergeries n'a un droit d'écriture que sur un
  // sous-ensemble de `cana.*` (voir COORDINATEUR_WRITABLE_FIELDS côté
  // serveur, qui reste la vraie protection) — restreint ici son accès
  // aux 3 étapes où il possède au moins un champ, plutôt que de le
  // laisser saisir partout et échouer à la sauvegarde.
  const COORDINATEUR_STEP_IDS = ["orientations", "monthly", "closure"];
  const disabled =
    isClosed ||
    isPasteur ||
    (isCoordinateur && !COORDINATEUR_STEP_IDS.includes(STEPS[activeIndex].id));

  useEffect(() => {
    if (!record.cana?.acknowledgedAt) {
      newSouls.acknowledge(record.id).then((updated) => {
        setRecord(updated);
        setData(updated.cana ?? {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    newSouls
      .listStaff("coordinateur_bergeries")
      .then((staff) => setCoordinateurOptions(staff.map((item) => ({ value: item.id, label: item.name }))));

    flocksApi
      .listAdmin({ status: "published" })
      .then((items) => setFlockOptions(items.map((item) => ({ value: item.id, label: item.name }))));
  }, []);

  const saveState = useAutoSave(
    data,
    (next) => newSouls.updateCana(record.id, next),
    { delay: 900 }
  );

  const patch = (fields) => setData((current) => ({ ...current, ...fields }));

  const handleClose = async () => {
    const updated = await newSouls.close(record.id);
    setRecord(updated);
    onUpdated?.(updated);
  };

  const { Component } = STEPS[activeIndex];
  const showConfidential = ["cana", "admin", "pasteur"].includes(currentRole);

  return (
    <div>
      <ReadonlySOAInfo soa={record.soa ?? {}} caseNumber={record.caseNumber} status={record.status} />

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
          formatDate={formatDate}
          responsableName={record.cana?.responsableName}
          coordinateurOptions={coordinateurOptions}
          flockOptions={flockOptions}
          showConfidential={showConfidential}
          canClose={["cana", "admin"].includes(currentRole)}
          onClose={handleClose}
        />
      </StepperShell>
    </div>
  );
};

export default CANAWizard;
