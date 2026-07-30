const StepSpiritualLife = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-conversion">Année de conversion</label>
      <input
        id="reg-conversion"
        type="number"
        min="1900"
        max="2100"
        value={state.data.conversionYear}
        onChange={(event) =>
          updateData({ conversionYear: event.target.value })
        }
      />
    </div>

    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.data.baptismWater}
          onChange={(event) =>
            updateData({ baptismWater: event.target.checked })
          }
        />
        Baptisé(e) d&apos;eau
      </label>

      {state.data.baptismWater && (
        <input
          type="number"
          min="1900"
          max="2100"
          placeholder="Année du baptême"
          aria-label="Année du baptême d'eau"
          value={state.data.baptismWaterYear}
          onChange={(event) =>
            updateData({ baptismWaterYear: event.target.value })
          }
        />
      )}
    </div>

    <div className="form-group">
      <label className="checkbox">
        <input
          type="checkbox"
          checked={state.data.baptismHolySpirit}
          onChange={(event) =>
            updateData({ baptismHolySpirit: event.target.checked })
          }
        />
        Baptisé(e) du Saint-Esprit
      </label>
    </div>

    <div className="form-group">
      <label htmlFor="reg-previous-church">Église précédente</label>
      <input
        id="reg-previous-church"
        type="text"
        placeholder="Facultatif"
        value={state.data.previousChurch}
        onChange={(event) =>
          updateData({ previousChurch: event.target.value })
        }
      />
    </div>
  </div>
);

export default StepSpiritualLife;
