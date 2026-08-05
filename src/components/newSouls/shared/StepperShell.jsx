import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

import "./NewSouls.scss";

const SAVE_LABELS = {
  idle: "",
  saving: "Enregistrement…",
  saved: "Enregistré",
  error: "Échec de l'enregistrement",
};

// Stepper vertical générique, réutilisé par SOAWizard et CANAWizard.
// Ne connaît rien du contenu de chaque étape : reçoit la liste des
// étapes (id, label, description et icône facultatifs), l'index actif,
// et rend `children` (le panneau de l'étape active) avec une
// transition Framer Motion. Habillage visuel uniquement — aucune
// donnée ni logique propre au module ici.
const StepperShell = ({ steps, activeIndex, onStepChange, saveState = "idle", footer, children }) => {
  const activeStep = steps[activeIndex];
  const ActiveIcon = activeStep?.Icon;

  return (
    <div className="stepper-shell">
      <nav className="stepper-shell__nav" aria-label="Étapes du dossier">
        {steps.map((step, index) => {
          const Icon = step.Icon;
          const done = index < activeIndex;
          const active = index === activeIndex;

          return (
            <button
              key={step.id}
              type="button"
              className={`stepper-shell__step${active ? " stepper-shell__step--active" : ""}${
                done ? " stepper-shell__step--done" : ""
              }`}
              onClick={() => onStepChange(index)}
            >
              <span className="stepper-shell__step-index">
                {done ? <Check size={13} aria-hidden="true" /> : Icon ? <Icon size={14} aria-hidden="true" /> : index + 1}
              </span>
              <span className="stepper-shell__step-text">
                <span className="stepper-shell__step-label">{step.label}</span>
                {step.description && (
                  <span className="stepper-shell__step-description">{step.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div>
        <div className="stepper-shell__panel">
          <div className="stepper-shell__panel-header">
            <span className="stepper-shell__eyebrow">
              Étape {activeIndex + 1} sur {steps.length}
            </span>
            <h3 className="stepper-shell__panel-title">
              {ActiveIcon && (
                <span className="stepper-shell__panel-icon">
                  <ActiveIcon size={18} aria-hidden="true" />
                </span>
              )}
              {activeStep?.label}
            </h3>
            {activeStep?.description && (
              <p className="stepper-shell__panel-description">{activeStep.description}</p>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={steps[activeIndex]?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="stepper-shell__footer">
          <div className="stepper-shell__save-state">{SAVE_LABELS[saveState]}</div>

          <div className="stepper-shell__footer-actions">
            {footer ?? (
              <>
                <button
                  type="button"
                  className="admin-form__button admin-form__button--ghost"
                  disabled={activeIndex === 0}
                  onClick={() => onStepChange(activeIndex - 1)}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="admin-form__button"
                  disabled={activeIndex === steps.length - 1}
                  onClick={() => onStepChange(activeIndex + 1)}
                >
                  Suivant
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sur mobile (≤640px, voir NewSouls.scss), la nav complète
            ci-dessus se masque : le parcours devient linéaire
            (Précédent/Suivant uniquement), avec ce simple compteur en
            repère — pas de liste d'étapes cliquables à faire tenir sur
            un écran de téléphone. */}
        <p className="stepper-shell__mobile-progress">
          {activeIndex + 1} / {steps.length}
        </p>
      </div>
    </div>
  );
};

export default StepperShell;
