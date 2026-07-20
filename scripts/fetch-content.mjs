// Récupération du contenu au moment du BUILD.
//
// ------------------------------------------------------------------
// POURQUOI CE SCRIPT PLUTÔT QU'UN CHARGEMENT DANS LE NAVIGATEUR
// ------------------------------------------------------------------
// Le site reste 100 % statique : le contenu est figé dans le HTML et
// le JavaScript au moment de la construction. Conséquences :
//
//   - Google voit le contenu (une SPA qui charge ses données après
//     coup n'est pas correctement indexée) ;
//   - les pages s'affichent instantanément, sans état de chargement ;
//   - le site public n'appelle JAMAIS l'API, donc il continue de
//     fonctionner si celle-ci tombe, et n'offre aucune surface
//     d'attaque côté visiteur.
//
// Contrepartie assumée : une modification faite dans l'administration
// n'apparaît qu'après une reconstruction (1 à 2 minutes), déclenchée
// par le bouton « Publier » de l'admin.
//
// C'est le fonctionnement des sites de contenu modernes (régénération
// statique), appliqué à une application Vite.

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../src/content");

const API =
  (process.env.VITE_API_URL ?? "http://localhost:4000").replace(
    /\/+$/,
    ""
  );

const TIMEOUT_MS = 15000;

const get = async (path) => {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(API + path, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `${path} a répondu ${response.status}`
      );
    }

    const payload = await response.json();

    return payload.data;
  } finally {
    clearTimeout(timer);
  }
};

// ---------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------
// La base stocke des données brutes ; les composants attendent des
// libellés prêts à afficher. La conversion se fait ICI, une fois au
// build, plutôt que dans chaque composant à chaque rendu.

const MOIS = [
  "JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE",
];

const JOURS = [
  "Dimanche", "Lundi", "Mardi", "Mercredi",
  "Jeudi", "Vendredi", "Samedi",
];

const capitalize = (s) =>
  s.charAt(0) + s.slice(1).toLowerCase();

const shapeEvent = (event) => {
  const date = new Date(event.startAt);

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MOIS[date.getUTCMonth()];

  const dateLong = `${JOURS[date.getUTCDay()]} ${date.getUTCDate()} ${capitalize(
    month
  )} ${date.getUTCFullYear()}${
    event.time ? ` - ${event.time}` : ""
  }`;

  return {
    id: event._id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    content: event.content ?? [],
    day,
    month,
    dateLong,
    time: event.time ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    address: event.address ?? "",
    audience: event.audience ?? "",
    theme: event.theme ?? "",
    speaker: event.speaker ?? null,
    image: event.image ?? "",
    color: event.color ?? "green",
  };
};

const shapeMedia = (media) => ({
  id: media._id,
  title: media.title,
  author: media.author,
  duration: media.duration ?? "",
  image: media.image,
  video: media.video ?? null,
  date: media.publishedAt
    ? new Date(media.publishedAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "",
});

// ---------------------------------------------------------------

const writeJson = async (name, data) => {
  await writeFile(
    resolve(OUT_DIR, name),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
};

const hasExistingContent = async () => {
  try {
    await access(resolve(OUT_DIR, "events.json"));

    return true;
  } catch {
    return false;
  }
};

const run = async () => {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`[contenu] source : ${API}`);

  const [events, ministries, medias, announcements, settings] =
    await Promise.all([
      get("/api/events"),
      get("/api/ministries"),
      get("/api/medias"),
      get("/api/announcements"),
      get("/api/settings"),
    ]);

  const shapedEvents = events.map(shapeEvent);

  // Indexé par slug : c'est ce qu'attendent les pages de détail.
  const eventsBySlug = Object.fromEntries(
    shapedEvents.map((e) => [e.slug, e])
  );

  const ministriesBySlug = Object.fromEntries(
    ministries.map((m) => [
      m.slug,
      { ...m, id: m._id, events: undefined },
    ])
  );

  const byCategory = (category) =>
    medias
      .filter((m) => m.category === category)
      .map(shapeMedia);

  await writeJson("events.json", eventsBySlug);
  await writeJson("ministries.json", ministriesBySlug);
  await writeJson("medias.json", {
    messages: byCategory("message"),
    louanges: byCategory("louange"),
    temoignages: byCategory("temoignage"),
  });
  await writeJson("announcements.json", announcements ?? []);
  await writeJson("settings.json", settings ?? {});

  console.log(
    `[contenu] ${shapedEvents.length} événement(s), ` +
      `${ministries.length} ministère(s), ` +
      `${medias.length} média(s), ` +
      `${(announcements ?? []).length} annonce(s)`
  );
};

run().catch(async (error) => {
  console.error(`\n[contenu] ÉCHEC : ${error.message}`);

  // Si du contenu a déjà été généré, on construit avec celui-là
  // plutôt que d'échouer : une API momentanément indisponible ne
  // doit pas empêcher un déploiement. Le contenu sera simplement
  // celui de la dernière génération réussie.
  if (await hasExistingContent()) {
    console.error(
      "[contenu] API injoignable — construction avec le contenu précédent.\n"
    );

    process.exit(0);
  }

  // En revanche, sans aucun contenu, mieux vaut échouer bruyamment
  // que publier un site vide sans que personne ne s'en aperçoive.
  console.error(
    "[contenu] Aucun contenu disponible : construction interrompue.\n" +
      "  Vérifiez que l'API est démarrée et que VITE_API_URL est correcte.\n"
  );

  process.exit(1);
});
