import "./VisionMission.scss";
import bibleImage from "../assets/images/bible.jpg";

import { HiUserGroup } from "react-icons/hi";
import { HiOutlineAcademicCap } from "react-icons/hi2";

const VisionMission = () => {
  return (
    <section className="vision-mission">
      <div className="vision-mission__container">

        <div className="vision-mission__left">

          <div className="vision-item">
            <div className="vision-item__icon">
              <HiUserGroup />
            </div>

            <div className="vision-item__content">
              <h3>NOTRE VISION</h3>

              <div className="vision-item__line"></div>

              <p>
                Communiquer la vie abondante de Dieu par la Parole et le Saint-Esprit
                à travers une Église spirituelle, organisée, structurée et impactante.
              </p>
            </div>
          </div>

          <div className="vision-separator"></div>

          <div className="vision-item">
            <div className="vision-item__icon">
              <HiOutlineAcademicCap />
            </div>

            <div className="vision-item__content">
              <h3>NOTRE MISSION</h3>

              <div className="vision-item__line"></div>

              <p>
                Le Centre Apostolique Vie et Abondance (ÇA.VA.) 
                a pour mission d'annoncer fidèlement l'Évangile de Jésus-Christ, 
                de conduire les hommes et les femmes à une relation vivante avec Lui, 
                de les accompagner dans leur croissance spirituelle, 
                de les former comme disciples, 
                de les équiper pour le service et de les envoyer afin qu'ils manifestent la 
                vie abondante de Dieu et les valeurs du Royaume dans tous les domaines de la société, 
                par la Parole et le Saint-Esprit.
              </p>
            </div>
          </div>

        </div>

        <div className="vision-mission__right">
          <img src={bibleImage} alt="Bible" />
        </div>

      </div>
    </section>
  );
};

export default VisionMission;