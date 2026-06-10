import "./DonationVerse.scss";

import { FaQuoteLeft } from "react-icons/fa";

import donationVerseImg from "../assets/images/donation-verse.jpg";

const DonationVerse = () => {
  return (
    <section className="donation-verse">
      <div className="donation-verse__container">

        <div className="donation-verse__content">

          <div className="donation-verse__icon">
            <FaQuoteLeft />
          </div>

          <div className="donation-verse__text">

            <p>
              Que chacun donne comme il l'a décidé en son cœur,
              non pas à regret ou par obligation, car Dieu aime
              celui qui donne avec joie.
            </p>

            <span>2 Corinthiens 9:7</span>

          </div>

        </div>

        <div className="donation-verse__image">
          <img
            src={donationVerseImg}
            alt="Générosité et croissance"
          />
        </div>

      </div>
    </section>
  );
};

export default DonationVerse;