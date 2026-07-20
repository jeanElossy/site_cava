import "./CalendarWidget.scss";

import { useState } from "react";

import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

import { eventsList } from "./EventDetails/data/events";

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

const monthIndexByName = {
  JANVIER: 0,
  FEVRIER: 1,
  MARS: 2,
  AVRIL: 3,
  MAI: 4,
  JUIN: 5,
  JUILLET: 6,
  AOUT: 7,
  SEPTEMBRE: 8,
  OCTOBRE: 9,
  NOVEMBRE: 10,
  DECEMBRE: 11,
};

// Retire les accents pour que "FÉVRIER" et "AOÛT" retombent sur les clés.
const normalizeMonth = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

// Le calendrier est dérivé de la source unique des événements : plus de
// jour actif codé en dur (il pointait le 25 mai, qui ne correspond à
// aucun événement depuis la refonte des données).
const eventDates = eventsList
  .map((event) => {
    const year = `${event.dateLong || event.date || ""}`.match(
      /\b(20\d{2})\b/
    );

    return {
      day: Number.parseInt(event.day, 10),
      month: monthIndexByName[normalizeMonth(event.month)],
      year: year ? Number(year[1]) : null,
      color: event.color === "yellow" ? "yellow" : "green",
      title: event.title,
    };
  })
  .filter(
    (date) =>
      Number.isInteger(date.day) &&
      Number.isInteger(date.month) &&
      Number.isInteger(date.year)
  );

// On ouvre le calendrier sur le mois du premier événement à venir.
const initialDate = eventDates.length
  ? new Date(eventDates[0].year, eventDates[0].month, 1)
  : new Date();

const CalendarWidget = () => {
  const [currentDate, setCurrentDate] = useState(initialDate);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const firstDay = new Date(year, month, 1);
  const startingDay =
    firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const findEvent = (day) =>
    eventDates.find(
      (date) =>
        date.day === day &&
        date.month === month &&
        date.year === year
    );

  const days = [];

  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="calendar-widget">

      {/* h2 : la page n'a qu'un h1 (le héros), les titres de section
          doivent rester au niveau 2. */}
      <h2>
        <FaCalendarAlt aria-hidden="true" />
        Calendrier
      </h2>

      <div className="calendar-widget__body">

        <div className="calendar-widget__header">

          <button
            type="button"
            onClick={prevMonth}
            aria-label="Mois précédent"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>

          <span aria-live="polite">
            {monthNames[month]} {year}
          </span>

          <button
            type="button"
            onClick={nextMonth}
            aria-label="Mois suivant"
          >
            <FaChevronRight aria-hidden="true" />
          </button>

        </div>

        <div className="calendar-widget__weekdays" aria-hidden="true">
          {weekDays.map((day, index) => (
            <span key={index}>{day}</span>
          ))}
        </div>

        <div className="calendar-widget__days">
          {days.map((day, index) => {
            const event = day ? findEvent(day) : null;

            return (
              <div
                key={index}
                className={
                  event
                    ? `day day--event day--${event.color}`
                    : "day"
                }
                title={event ? event.title : undefined}
              >
                {day}

                {event && (
                  <span className="sr-only">
                    {" "}
                    — {event.title}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="calendar-widget__legend">

          <div>
            <span className="dot green" aria-hidden="true" />
            Événements
          </div>

          <div>
            <span className="dot yellow" aria-hidden="true" />
            Événements spéciaux
          </div>

        </div>

      </div>

    </div>
  );
};

export default CalendarWidget;
