import {
  FaBullseye,
  FaEye,
} from "react-icons/fa";

import "./MinistryMission.scss";

const MinistryMission = ({
  ministry,
}) => {
  return (
    <section className="ministry-mission">

      <div className="container">

        <div className="mission-card">

          <FaBullseye />

          <div>

            <h3>
              {ministry?.mission?.title ||
                "Notre Mission"}
            </h3>

            <p>
              {ministry?.mission
                ?.description ||
                "Mission en cours de définition."}
            </p>

          </div>

        </div>

        <div className="mission-card">

          <FaEye />

          <div>

            <h3>
              {ministry?.vision?.title ||
                "Notre Vision"}
            </h3>

            <p>
              {ministry?.vision
                ?.description ||
                "Vision en cours de définition."}
            </p>

          </div>

        </div>

      </div>

    </section>
  );
};

export default MinistryMission;