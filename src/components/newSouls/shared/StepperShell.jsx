import { AnimatePresence, motion } from "framer-motion";

import "./NewSouls.scss";

const SAVE_LABELS = {
  idle: "",
  saving: "Enregistrement…",
  saved: "Enregistré",
  error: "Échec de l'enregistrement",
};

// Stepper vertical générique, réutilisé par SOAWizard et CANAWizard.
// Ne connaît rien du contenu de chaque étape : reçoit la liste des
// étapes, l'index actif, et rend `children` (le panneau de l'étape
// active) avec une transition Framer Motion.
const StepperShell = ({ steps, activeIndex, onStepChange, saveState = "idle", footer, children }) => (
  <div className="stepper-shell">
    <nav className="stepper-shell__nav" aria-label="Étapes du dossier">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          className={`stepper-shell__step${
            index === activeIndex ? " stepper-shell__step--active" : ""
          }${index < activeIndex ? " stepper-shell__step--done" : ""}`}
          onClick={() => onStepChange(index)}
        >
          <span className="stepper-shell__step-index">{index + 1}</span>
          {step.label}
        </button>
      ))}
    </nav>

    <div>
      <div className="stepper-shell__panel">
        <h3 className="stepper-shell__panel-title">{steps[activeIndex]?.label}</h3>

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
    </div>
  </div>
);

export default StepperShell;
