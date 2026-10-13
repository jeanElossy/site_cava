// Date réelle d'un événement, reconstituée depuis les champs du contenu.
//
// Les événements ne portent pas de date machine : seulement `day`
// (« 09 »), `month` (« AOÛT »), `time` (« 08h30 ») et une date longue
// (« Dimanche 9 Août 2026 - 08h30 ») d'où l'on tire l'année. Sans cette
// reconstitution, l'accueil présentait comme « prochains » des
// événements passés depuis des semaines.

const MONTHS = {
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

const normalize = (value = "") =>
  `${value}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

// Renvoie une `Date` locale, ou `null` si un élément manque : un
// événement sans date lisible n'est jamais présenté comme « à venir ».
export const eventStartDate = (event) => {
  if (!event) return null;

  const day = Number.parseInt(event.day, 10);
  const month = MONTHS[normalize(event.month)];
  const year = `${event.dateLong ?? ""}`.match(/\b(20\d{2})\b/);

  if (!Number.isInteger(day) || month === undefined || !year) return null;

  const time = `${event.time ?? ""}`.match(/(\d{1,2})\s*[hH:]\s*(\d{2})?/);
  const hours = time ? Number(time[1]) : 0;
  const minutes = time?.[2] ? Number(time[2]) : 0;

  const date = new Date(Number(year[1]), month, day, hours, minutes);

  // `new Date(2026, 1, 31)` glisse silencieusement au 3 mars.
  return date.getDate() === day && date.getMonth() === month ? date : null;
};

// Événements à venir, du plus proche au plus lointain. Un événement du
// jour reste affiché toute la journée, même une fois commencé.
export const upcomingEvents = (events, now = new Date(), limit = Infinity) => {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return (events ?? [])
    .map((event) => ({ event, date: eventStartDate(event) }))
    .filter(({ date }) => date && date >= startOfToday)
    .sort((a, b) => a.date - b.date)
    .slice(0, limit)
    .map(({ event }) => event);
};

// Libellé de date lisible (« Mercredi 2 Septembre 2026 »), sans l'heure.
//
// Le hero et les informations pratiques lisaient `event.date`, un champ
// qui n'existe pas : la pastille de date s'affichait vide, et la carte
// « Date » disparaissait des informations pratiques.
export const eventDateLabel = (event) => {
  if (!event) return "";

  if (event.date) return `${event.date}`;

  return `${event.dateLong ?? ""}`.split(" - ")[0].trim();
};

// Vrai si l'événement est entièrement passé (la veille ou avant).
export const isPastEvent = (event, now = new Date()) => {
  const date = eventStartDate(event);

  if (!date) return false;

  return (
    date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
  );
};

// Événements passés, du plus récent au plus ancien.
export const pastEvents = (events, now = new Date()) =>
  (events ?? [])
    .map((event) => ({ event, date: eventStartDate(event) }))
    .filter(({ event }) => isPastEvent(event, now))
    .sort((a, b) => b.date - a.date)
    .map(({ event }) => event);
