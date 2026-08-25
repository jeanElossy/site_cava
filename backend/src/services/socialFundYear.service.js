import SocialFundYear from "../models/SocialFundYear.js";
import SocialLedgerEntry from "../models/SocialLedgerEntry.js";

import { ApiError } from "../utils/ApiError.js";

// Exercices annuels de la caisse sociale — ouverture, clôture, report
// du solde, et SEUL point d'écriture d'un mouvement de caisse.
//
// Extrait de socialContribution.service.js plutôt qu'ajouté dedans :
// les cotisations (qui doit combien, pour quel mois) et la caisse
// (combien il y a dans le tiroir cette année) sont deux sujets
// distincts, et le premier fichier dépassait déjà 850 lignes. Les
// deux autres services du module (cotisations, aides) écrivent
// désormais leurs mouvements ici, jamais directement dans
// `SocialLedgerEntry`.

// Première année couverte par le module. Antérieurement à 2024, la
// trésorerie du Service Social n'a pas d'historique exploitable : le
// solde d'avant est repris en bloc dans l'`openingBalance` de
// l'exercice 2024 (voir SocialFundYear.js et le script de migration).
// Sert aussi de borne basse au rattrapage des cotisations, côté
// socialContribution.service.js.
export const SOCIAL_START_YEAR = 2024;

const MAX_YEAR = 2100;

const isChurch = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 5;

// Année courante TOUJOURS calculée côté serveur (UTC), jamais reçue du
// client : un client qui choisirait son exercice pourrait encaisser
// dans une caisse clôturée ou fausser un report.
export const currentYear = () => new Date().getUTCFullYear();

const assertChurch = (church) => {
  const churchNumber = Number(church);

  if (!isChurch(churchNumber)) {
    throw ApiError.unprocessable("Église invalide.", {
      church: "L'église doit être un nombre entre 1 et 5.",
    });
  }

  return churchNumber;
};

const assertYear = (year) => {
  const yearNumber = Number(year);

  if (
    !Number.isInteger(yearNumber) ||
    yearNumber < SOCIAL_START_YEAR ||
    yearNumber > MAX_YEAR
  ) {
    throw ApiError.unprocessable("Exercice invalide.", {
      year: `L'exercice doit être une année entre ${SOCIAL_START_YEAR} et ${MAX_YEAR}.`,
    });
  }

  return yearNumber;
};

// ------------------------------------------------------------------
// REPORT DU SOLDE
// ------------------------------------------------------------------
// Solde d'ouverture d'un exercice = solde de clôture du précédent.
//
// Calculé par la somme de TOUS les mouvements antérieurs plutôt qu'en
// remontant la chaîne exercice par exercice : le résultat est le même
// quand la chaîne est complète (cas normal), mais il reste juste même
// s'il manque un exercice intermédiaire — un trou de chaînage ne peut
// alors pas faire disparaître silencieusement l'argent d'une année.
const carriedOpeningBalanceFor = async (church, year) => {
  const earliest = await SocialFundYear.findOne({
    church,
    year: { $lt: year },
  })
    .sort({ year: 1 })
    .lean();

  // Aucun exercice antérieur : c'est le premier de cette église, son
  // solde d'ouverture est celui saisi à la main (ou 0).
  if (!earliest) return 0;

  const [aggregate] = await SocialLedgerEntry.aggregate([
    {
      $match: {
        church,
        year: { $gte: earliest.year, $lt: year },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return (earliest.openingBalance || 0) + (aggregate?.total ?? 0);
};

// ------------------------------------------------------------------
// OUVERTURE
// ------------------------------------------------------------------

// Récupère l'exercice, en le créant au report si besoin.
//
// Appelée sur le chemin d'écriture d'un mouvement : le 1er janvier,
// le premier encaissement de l'année ouvre la caisse tout seul. La
// clôture explicite reste utile (elle fige l'exercice et interdit
// toute écriture supplémentaire), mais l'oublier ne fait jamais perdre
// d'argent.
export const ensureFundYear = async (church, year, user) => {
  const existing = await SocialFundYear.findOne({ church, year }).lean();

  if (existing) return existing;

  const openingBalance = await carriedOpeningBalanceFor(church, year);

  try {
    const created = await SocialFundYear.findOneAndUpdate(
      { church, year },
      {
        $setOnInsert: {
          church,
          year,
          openingBalance,
          status: "ouvert",
          openedBy: user?.id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    return created.toObject();
  } catch (error) {
    // Course entre deux agents encaissant au même instant : l'index
    // unique {church, year} a tranché, on relit le gagnant plutôt que
    // de faire échouer l'encaissement.
    if (error?.code === 11000) {
      return SocialFundYear.findOne({ church, year }).lean();
    }

    throw error;
  }
};

// Ouverture explicite depuis l'administration. Le solde d'ouverture
// n'est saisissable QUE pour le tout premier exercice d'une église
// (reprise de la trésorerie d'avant-système) : pour les suivants,
// c'est un report calculé, qu'une saisie libre pourrait contredire.
export const openFundYear = async (
  church,
  { year, openingBalance } = {},
  user
) => {
  const churchNumber = assertChurch(church);
  const yearNumber = assertYear(year);

  const existing = await SocialFundYear.findOne({
    church: churchNumber,
    year: yearNumber,
  }).lean();

  if (existing) {
    throw ApiError.conflict(
      `L'exercice ${yearNumber} de cette église est déjà ouvert.`
    );
  }

  const previous = await SocialFundYear.findOne({
    church: churchNumber,
    year: { $lt: yearNumber },
  }).lean();

  let opening;

  if (previous) {
    opening = await carriedOpeningBalanceFor(churchNumber, yearNumber);
  } else {
    opening = Number(openingBalance ?? 0);

    if (!Number.isFinite(opening) || opening < 0) {
      throw ApiError.unprocessable("Solde d'ouverture invalide.", {
        openingBalance: "Le solde d'ouverture doit être un nombre positif ou nul.",
      });
    }
  }

  try {
    const created = await SocialFundYear.create({
      church: churchNumber,
      year: yearNumber,
      openingBalance: opening,
      status: "ouvert",
      openedBy: user?.id,
    });

    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict(
        `L'exercice ${yearNumber} de cette église est déjà ouvert.`
      );
    }

    throw error;
  }
};

// ------------------------------------------------------------------
// SOLDES
// ------------------------------------------------------------------

const movementTotals = async (church, year) => {
  const [aggregate] = await SocialLedgerEntry.aggregate([
    { $match: { church, year } },
    {
      $group: {
        _id: null,
        totalIn: {
          $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] },
        },
        totalOut: {
          $sum: { $cond: [{ $lt: ["$amount", 0] }, "$amount", 0] },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    // `totalOut` est présenté POSITIF (« 12 000 F sortis »), alors que
    // les écritures de sortie sont stockées négatives : c'est le sens
    // attendu dans un tableau entrées/sorties.
    totalIn: aggregate?.totalIn ?? 0,
    totalOut: Math.abs(aggregate?.totalOut ?? 0),
    movementsCount: aggregate?.count ?? 0,
  };
};

// État complet d'une caisse annuelle. Fonctionne même si l'exercice
// n'a pas encore de document (1er janvier avant le premier
// encaissement) : le solde d'ouverture est alors le report calculé, et
// le solde courant lui est égal.
export const computeYearBalance = async (church, year) => {
  const churchNumber = Number(church);
  const yearNumber = Number(year);

  if (!isChurch(churchNumber) || !Number.isInteger(yearNumber)) {
    return {
      church: churchNumber,
      year: yearNumber,
      exists: false,
      status: "ouvert",
      openingBalance: 0,
      totalIn: 0,
      totalOut: 0,
      movementsCount: 0,
      currentBalance: 0,
      closingBalance: null,
      closedAt: null,
    };
  }

  const [fundYear, totals] = await Promise.all([
    SocialFundYear.findOne({ church: churchNumber, year: yearNumber }).lean(),
    movementTotals(churchNumber, yearNumber),
  ]);

  const openingBalance = fundYear
    ? fundYear.openingBalance || 0
    : await carriedOpeningBalanceFor(churchNumber, yearNumber);

  return {
    church: churchNumber,
    year: yearNumber,
    exists: Boolean(fundYear),
    status: fundYear?.status ?? "ouvert",
    openingBalance,
    totalIn: totals.totalIn,
    totalOut: totals.totalOut,
    movementsCount: totals.movementsCount,
    currentBalance: openingBalance + totals.totalIn - totals.totalOut,
    closingBalance: fundYear?.closingBalance ?? null,
    closedAt: fundYear?.closedAt ?? null,
  };
};

// Solde disponible ICI ET MAINTENANT, c'est-à-dire dans l'exercice en
// cours. Utilisé par socialAid.service.js#validateAid pour refuser un
// décaissement supérieur à ce que contient la caisse.
export const computeCurrentBalance = async (church) => {
  const { currentBalance } = await computeYearBalance(church, currentYear());

  return currentBalance;
};

export const listFundYears = async ({ church } = {}) => {
  const churchNumber = Number(church);

  if (!isChurch(churchNumber)) return [];

  const years = await SocialFundYear.find({ church: churchNumber })
    .sort({ year: -1 })
    .populate("closedBy", "name")
    .lean();

  // Le module vient d'être configuré (aucun exercice) : on annonce au
  // moins l'exercice courant, pour que l'écran ait une année à
  // sélectionner et propose son ouverture.
  if (years.length === 0) {
    return [await computeYearBalance(churchNumber, currentYear())];
  }

  return Promise.all(
    years.map(async (year) => ({
      ...(await computeYearBalance(churchNumber, year.year)),
      closedBy: year.closedBy ?? null,
    }))
  );
};

// ------------------------------------------------------------------
// ÉCRITURE D'UN MOUVEMENT — POINT DE PASSAGE UNIQUE
// ------------------------------------------------------------------

// Vérifie qu'un encaissement/décaissement est possible AVANT toute
// modification métier.
//
// Indispensable : `recordPayments` et `validateAid` mettent d'abord à
// jour leur document (cotisation, aide) puis journalisent le
// mouvement. Découvrir la clôture au moment d'écrire au journal
// laisserait une opération enregistrée sans contrepartie en caisse —
// exactement l'incohérence que ce module s'interdit.
export const assertExerciceOpen = async (church, user) => {
  const churchNumber = assertChurch(church);
  const year = currentYear();

  const fundYear = await ensureFundYear(churchNumber, year, user);

  if (fundYear?.status === "cloture") {
    throw ApiError.conflict(
      `L'exercice ${year} de cette église est clôturé : aucun mouvement de caisse ne peut plus y être enregistré. ` +
        "Rouvrez l'exercice depuis Service Social → Caisse pour reprendre les encaissements."
    );
  }

  return fundYear;
};

// SEUL moyen d'écrire au journal de caisse. Rattache le mouvement à
// l'exercice courant et refuse d'écrire dans une caisse clôturée.
export const recordLedgerEntry = async (
  { church, type, reference, description, amount },
  user
) => {
  const fundYear = await assertExerciceOpen(church, user);

  return SocialLedgerEntry.create({
    church: fundYear.church,
    year: fundYear.year,
    type,
    reference,
    description,
    amount,
    recordedBy: user?.id,
  });
};

// ------------------------------------------------------------------
// CLÔTURE / RÉOUVERTURE
// ------------------------------------------------------------------

export const closeFundYear = async (church, year, user) => {
  const churchNumber = assertChurch(church);
  const yearNumber = assertYear(year);

  if (yearNumber > currentYear()) {
    throw ApiError.conflict(
      "Un exercice à venir ne peut pas être clôturé avant d'avoir commencé."
    );
  }

  const balance = await computeYearBalance(churchNumber, yearNumber);

  if (!balance.exists) {
    throw ApiError.notFound("Cet exercice n'existe pas.");
  }

  // Verrou optimiste sur `status` : deux clôtures simultanées ne
  // peuvent pas figer deux soldes différents — même esprit que
  // socialContribution.service.js#recordPayments.
  const closed = await SocialFundYear.findOneAndUpdate(
    { church: churchNumber, year: yearNumber, status: "ouvert" },
    {
      $set: {
        status: "cloture",
        closingBalance: balance.currentBalance,
        closedAt: new Date(),
        closedBy: user?.id,
      },
    },
    { new: true }
  );

  if (!closed) {
    throw ApiError.conflict("Cet exercice est déjà clôturé.");
  }

  // Ouverture immédiate de l'exercice suivant, au solde reporté :
  // c'est le geste attendu par le client (« quand on avance dans les
  // années, on crée une nouvelle caisse »), et ça évite qu'un
  // encaissement du 1er janvier tombe sur une caisse inexistante.
  const next =
    yearNumber < MAX_YEAR
      ? await ensureFundYear(churchNumber, yearNumber + 1, user)
      : null;

  return {
    closed: closed.toObject(),
    next: next ?? null,
  };
};

export const reopenFundYear = async (church, year, user) => {
  const churchNumber = assertChurch(church);
  const yearNumber = assertYear(year);

  const reopened = await SocialFundYear.findOneAndUpdate(
    { church: churchNumber, year: yearNumber, status: "cloture" },
    {
      $set: { status: "ouvert", openedBy: user?.id },
      // La photographie de clôture est retirée, pas conservée : elle
      // ne décrirait plus l'état réel de l'exercice une fois celui-ci
      // rouvert aux écritures.
      $unset: { closingBalance: "", closedAt: "", closedBy: "" },
    },
    { new: true }
  );

  if (!reopened) {
    const existing = await SocialFundYear.findOne({
      church: churchNumber,
      year: yearNumber,
    }).lean();

    if (!existing) throw ApiError.notFound("Cet exercice n'existe pas.");

    throw ApiError.conflict("Cet exercice est déjà ouvert.");
  }

  return reopened.toObject();
};
