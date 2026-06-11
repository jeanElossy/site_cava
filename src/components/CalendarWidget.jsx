import "./CalendarWidget.scss";

import { useState } from "react";

import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const monthNames = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const weekDays = ["L", "M", "M", "J", "V", "S", "D"];

const CalendarWidget = () => {
  const [currentDate, setCurrentDate] = useState(
    new Date(2025, 4, 25)
  );

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const firstDay = new Date(year, month, 1);
  const startingDay =
    firstDay.getDay() === 0
      ? 6
      : firstDay.getDay() - 1;

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  const prevMonth = () => {
    setCurrentDate(
      new Date(year, month - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(year, month + 1, 1)
    );
  };

  const days = [];

  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="calendar-widget">

      <h3>
        <FaCalendarAlt />
        Calendrier
      </h3>

      <div className="calendar-widget__body">

        <div className="calendar-widget__header">

          <button onClick={prevMonth}>
            <FaChevronLeft />
          </button>

          <span>
            {monthNames[month]} {year}
          </span>

          <button onClick={nextMonth}>
            <FaChevronRight />
          </button>

        </div>

        <div className="calendar-widget__weekdays">
          {weekDays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-widget__days">
          {days.map((day, index) => (
            <div
              key={index}
              className={
                day === 25
                  ? "day active"
                  : "day"
              }
            >
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-widget__legend">

          <div>
            <span className="dot green" />
            Événements
          </div>

          <div>
            <span className="dot yellow" />
            Événements spéciaux
          </div>

        </div>

      </div>

    </div>
  );
};

export default CalendarWidget;