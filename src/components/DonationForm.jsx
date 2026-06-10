import "./DonationForm.scss";

import visaLogo from "../assets/images/visa.png";
import waveLogo from "../assets/images/wave.jpg";
import mtnLogo from "../assets/images/mtn-money.jpg";
import moovLogo from "../assets/images/moov-money.png";
import orangeLogo from "../assets/images/orange-money.png";



import {
  FaShieldAlt,
  FaLock,
  FaArrowRight,
} from "react-icons/fa";

const DonationForm = () => {
  return (
    <section className="donation-form">

      <div className="donation-form__container">

        <div className="donation-form__header">

          <h2>Choisissez votre don</h2>

          <div className="donation-form__line" />

          <p>
            Chaque don, quel que soit son montant,
            fait une réelle différence.
          </p>

        </div>

        <div className="donation-form__amounts">

          <button className="amount-card">
            <strong>5 000</strong>
            <span>FCFA</span>
          </button>

          <button className="amount-card active">

            <span className="popular-badge">
              Populaire
            </span>

            <strong>10 000</strong>
            <span>FCFA</span>

          </button>

          <button className="amount-card">
            <strong>20 000</strong>
            <span>FCFA</span>
          </button>

          <button className="amount-card">
            <strong>50 000</strong>
            <span>FCFA</span>
          </button>

          <div className="amount-card custom">

            <h4>Autre montant</h4>

            <div className="custom-input">
              <input
                type="number"
                placeholder="Montant"
              />

              <span>FCFA</span>
            </div>

          </div>

        </div>

        <div className="donation-form__bottom">

          <div className="donation-form__left">

            <label>
              Affecter mon don à :
            </label>

            <select>
              <option>
                Œuvre générale (besoins prioritaires)
              </option>

              <option>
                Évangélisation
              </option>

              <option>
                Aide sociale
              </option>

              <option>
                Formation biblique
              </option>

              <option>
                Construction & équipements
              </option>
            </select>

            <button className="donation-btn">
              Faire un don maintenant
              <FaArrowRight />
            </button>

            <div className="secure">
              <FaLock />
              Paiement 100% sécurisé
            </div>

          </div>

          <div className="donation-form__security">

            <div className="security-header">

              <FaShieldAlt />

              <div>

                <h4>
                  Votre sécurité est notre priorité
                </h4>

                <p>
                  Toutes les transactions sont sécurisées
                  et vos informations restent confidentielles.
                </p>

              </div>

            </div>


            <div className="payments">

              <div className="payment-card">
                <img src={visaLogo} alt="Visa" />
              </div>

              <div className="payment-card">
                <img src={waveLogo} alt="Wave" />
              </div>

              <div className="payment-card">
                <img src={mtnLogo} alt="MTN Money" />
              </div>

              <div className="payment-card">
                <img src={orangeLogo} alt="Orange Money" />
              </div>

              <div className="payment-card">
                <img src={moovLogo} alt="Moov Money" />
              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
};

export default DonationForm;