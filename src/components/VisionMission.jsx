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
                Être une église passionnée par la présence de Dieu,
                qui forme des disciples et envoie des leaders
                pour transformer le monde.
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
                Conduire chacun à une relation intime avec Jésus-Christ,
                l'aider à découvrir son identité en Lui et l'équiper
                pour impacter son monde avec l'amour de Dieu.
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