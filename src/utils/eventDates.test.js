import { describe, expect, it } from "vitest";

import {
  eventDateLabel,
  eventStartDate,
  isPastEvent,
  pastEvents,
  upcomingEvents,
} from "./eventDates";

const make = (slug, day, month, year, time = "08h30") => ({
  slug,
  day,
  month,
  time,
  dateLong: `Dimanche ${day} ${month} ${year} - ${time}`,
});

describe("eventStartDate", () => {
  it("reconstitue la date et l'heure, accents et casse ignorés", () => {
    const date = eventStartDate(make("a", "09", "AOÛT", 2026, "18h30"));

    expect(date).toEqual(new Date(2026, 7, 9, 18, 30));
  });

  it("accepte une heure sans minutes", () => {
    expect(eventStartDate(make("a", "1", "Février", 2027, "9h"))).toEqual(
      new Date(2027, 1, 1, 9, 0)
    );
  });

  it("renvoie null quand l'année, le mois ou le jour manque", () => {
    expect(eventStartDate({ day: "09", month: "AOÛT" })).toBeNull();
    expect(eventStartDate(make("a", "09", "Brumaire", 2026))).toBeNull();
    expect(eventStartDate(make("a", "", "AOÛT", 2026))).toBeNull();
  });

  it("refuse une date impossible au lieu de la faire glisser", () => {
    expect(eventStartDate(make("a", "31", "FÉVRIER", 2026))).toBeNull();
  });
});

describe("upcomingEvents", () => {
  const now = new Date(2026, 9, 13, 15, 0);

  it("écarte les événements passés et trie du plus proche au plus lointain", () => {
    const list = [
      make("loin", "20", "DÉCEMBRE", 2026),
      make("passe", "09", "AOÛT", 2026),
      make("proche", "18", "OCTOBRE", 2026),
    ];

    expect(upcomingEvents(list, now).map((e) => e.slug)).toEqual([
      "proche",
      "loin",
    ]);
  });

  it("garde un événement du jour même déjà commencé", () => {
    const list = [make("matin", "13", "OCTOBRE", 2026, "08h30")];

    expect(upcomingEvents(list, now)).toHaveLength(1);
  });

  it("ignore les événements sans date lisible et respecte la limite", () => {
    const list = [
      { slug: "sans-date" },
      make("a", "14", "OCTOBRE", 2026),
      make("b", "15", "OCTOBRE", 2026),
    ];

    expect(upcomingEvents(list, now, 1).map((e) => e.slug)).toEqual(["a"]);
    expect(upcomingEvents(undefined, now)).toEqual([]);
  });
});

describe("eventDateLabel", () => {
  it("retire l'heure de la date longue", () => {
    expect(eventDateLabel(make("a", "2", "Septembre", 2026))).toBe(
      "Dimanche 2 Septembre 2026"
    );
  });

  it("préfère un champ `date` explicite et tolère l'absence", () => {
    expect(eventDateLabel({ date: "Demain" })).toBe("Demain");
    expect(eventDateLabel(undefined)).toBe("");
  });
});

describe("pastEvents / isPastEvent", () => {
  const now = new Date(2026, 9, 13, 15, 0);

  it("ne compte pas un événement du jour comme passé", () => {
    expect(isPastEvent(make("a", "13", "OCTOBRE", 2026), now)).toBe(false);
    expect(isPastEvent(make("b", "12", "OCTOBRE", 2026), now)).toBe(true);
    expect(isPastEvent({ slug: "sans-date" }, now)).toBe(false);
  });

  it("trie les passés du plus récent au plus ancien", () => {
    const list = [
      make("aout", "09", "AOÛT", 2026),
      make("futur", "20", "DÉCEMBRE", 2026),
      make("sept", "02", "SEPTEMBRE", 2026),
    ];

    expect(pastEvents(list, now).map((e) => e.slug)).toEqual([
      "sept",
      "aout",
    ]);
  });
});
