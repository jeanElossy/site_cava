import { useState } from "react";

import { Link } from "react-router-dom";

import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

import { eventsList } from "./EventDetails/data/events";

import { eventStartDate } from "../utils/eventDates";

import "./CalendarWidget.scss";

const MONTH_NAMES = [
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

const WEEK_DAYS = [
  { short: "L", long: "lundi" },
  { short: "M", long: "mardi" },
  { short: "M", long: "mercredi" },
  { short: "J", long: "jeudi" },
  { short: "V", long: "vendredi" },
  { short: "S", long: "samedi" },
  { short: "D", long: "dimanche" },
];

// Dates réelles des événements, par la même fonction que l'accueil et la
// liste (`utils/eventDates`) : la reconstitution était auparavant dupliquée
// ici.
const EVENT_DATES = eventsList
  .map((event) => ({ event, date: eventStartDate(event) }))
  .filter(({ date }) => date);

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Calendrier mensuel de la page Événements.
 *
 * Il s'ouvrait sur le mois du PREMIER événement de la liste (août), et les
 * jours d'événement portaient des classes (`day--event`) qu'aucun style ne
 * définissait : rien n'était mis en évidence. Il s'ouvre désormais sur le
 * mois courant, repère aujourd'hui, et chaque jour d'événement est un lien
 * vers sa fiche.
 */
const CalendarWidget = () => {
  const [today] = useState(() => new Date());

  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  // Lundi en premier : `getDay()` renvoie 0 pour dimanche.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const eventOn = (date) =>
    EVENT_DATES.find((entry) => sameDay(entry.date, date))?.event;

  const monthEvents = EVENT_DATES.filter(
    ({ date }) => date.getFullYear() === year && date.getMonth() === month
  ).length;

  const move = (step) => setCursor(new Date(year, month + step, 1));

  return (
    <div className="calendar-widget">
      {/* h2 : la page n'a qu'un h1 (le héros). */}
      <h2>
        <FaCalendarAlt aria-hidden="true" />
        Calendrier
      </h2>

      <div className="calendar-widget__header">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Mois précédent"
        >
          <FaChevronLeft aria-hidden="true" />
        </button>

        <span aria-live="polite">
          {MONTH_NAMES[month]} {year}
        </span>

        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Mois suivant"
        >
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>

      {/* Pas de rôles ARIA de grille : un calendrier en une seule rangée
          de 31 cellules décrirait une structure fausse. Les jours sans
          événement sont décoratifs ; les jours d'événement sont des liens
          explicitement libellés, résumés sous la grille. */}
      <div className="calendar-widget__grid">
        <div
          className="calendar-widget__row"
          aria-hidden="true"
        >
          {WEEK_DAYS.map((day) => (
            <span
              key={day.long}
              className="calendar-widget__weekday"
            >
              {day.short}
            </span>
          ))}
        </div>

        <div className="calendar-widget__days">
          {cells.map((date, index) => {
            if (!date) {
              return (
                <span
                  key={`vide-${index}`}
                  className="calendar-widget__day calendar-widget__day--empty"
                  aria-hidden="true"
                />
              );
            }

            const event = eventOn(date);

            const classes = [
              "calendar-widget__day",
              sameDay(date, today) && "calendar-widget__day--today",
              event && "calendar-widget__day--event",
              event?.color === "yellow" && "calendar-widget__day--special",
            ]
              .filter(Boolean)
              .join(" ");

            return event ? (
              <Link
                key={date.getDate()}
                to={`/events/${event.slug}`}
                className={classes}
                title={event.title}
                aria-label={`${date.getDate()} ${MONTH_NAMES[month]} : ${event.title}`}
              >
                {date.getDate()}
              </Link>
            ) : (
              <span
                key={date.getDate()}
                className={classes}
                aria-hidden="true"
              >
                {date.getDate()}
              </span>
            );
          })}
        </div>
      </div>

      <p className="calendar-widget__summary">
        {monthEvents === 0
          ? "Aucun événement ce mois-ci."
          : `${monthEvents} événement${monthEvents > 1 ? "s" : ""} ce mois-ci.`}
      </p>

      <ul className="calendar-widget__legend">
        <li>
          <span
            className="calendar-widget__dot calendar-widget__dot--event"
            aria-hidden="true"
          />
          Événement
        </li>

        <li>
          <span
            className="calendar-widget__dot calendar-widget__dot--special"
            aria-hidden="true"
          />
          Événement spécial
        </li>

        <li>
          <span
            className="calendar-widget__dot calendar-widget__dot--today"
            aria-hidden="true"
          />
          Aujourd&apos;hui
        </li>
      </ul>
    </div>
  );
};

export default CalendarWidget;
