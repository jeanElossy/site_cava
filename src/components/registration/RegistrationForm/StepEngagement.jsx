const StepEngagement = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-profession">Profession</label>
      <input
        id="reg-profession"
        type="text"
        value={state.data.profession}
        onChange={(event) => updateData({ profession: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-skills">Compétences</label>
      <input
        id="reg-skills"
        type="text"
        placeholder="Musique, informatique, accueil…"
        value={state.data.skills}
        onChange={(event) => updateData({ skills: event.target.value })}
      />
      <p className="field-help">
        Séparez chaque compétence par une virgule.
      </p>
    </div>

    <div className="form-group">
      <label htmlFor="reg-department">Département souhaité</label>
      <input
        id="reg-department"
        type="text"
        placeholder="Louange, accueil, intercession…"
        value={state.data.desiredDepartment}
        onChange={(event) =>
          updateData({ desiredDepartment: event.target.value })
        }
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-availability">Disponibilités</label>
      <input
        id="reg-availability"
        type="text"
        placeholder="Samedi après-midi, dimanche matin…"
        value={state.data.availability}
        onChange={(event) =>
          updateData({ availability: event.target.value })
        }
      />
    </div>
  </div>
);

export default StepEngagement;
