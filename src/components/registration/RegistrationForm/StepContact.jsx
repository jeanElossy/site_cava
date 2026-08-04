const StepContact = ({ state, updateData }) => (
  <div className="step-panel">
    <div className="form-group">
      <label htmlFor="reg-phone">Téléphone</label>
      <input
        id="reg-phone"
        type="tel"
        placeholder="+225 07 00 00 00 00"
        value={state.data.phone}
        onChange={(event) => updateData({ phone: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-whatsapp">WhatsApp</label>
      <input
        id="reg-whatsapp"
        type="tel"
        placeholder="Confirmez votre numero"
        value={state.data.whatsapp}
        onChange={(event) => updateData({ whatsapp: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-email">E-mail</label>
      <input
        id="reg-email"
        type="email"
        value={state.data.email}
        onChange={(event) => updateData({ email: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-address">Adresse</label>
      <input
        id="reg-address"
        type="text"
        placeholder="Angré 7e tranche"
        value={state.data.address}
        onChange={(event) => updateData({ address: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label htmlFor="reg-area">Quartier / groupe de maison</label>
      <input
        id="reg-area"
        type="text"
        placeholder="Ex. Angré, Cocody"
        value={state.data.area}
        onChange={(event) => updateData({ area: event.target.value })}
      />
    </div>

    <div className="form-group">
      <label>Personne à prévenir en cas d&apos;urgence</label>

      <div className="contact-grid">
        <input
          type="text"
          placeholder="Nom"
          aria-label="Nom de la personne à prévenir"
          value={state.data.emergencyContactName}
          onChange={(event) =>
            updateData({ emergencyContactName: event.target.value })
          }
        />

        <input
          type="tel"
          placeholder="Téléphone"
          aria-label="Téléphone de la personne à prévenir"
          value={state.data.emergencyContactPhone}
          onChange={(event) =>
            updateData({ emergencyContactPhone: event.target.value })
          }
        />
      </div>
    </div>
  </div>
);

export default StepContact;
