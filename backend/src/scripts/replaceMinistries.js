import mongoose from "mongoose";

import { env, validateEnv } from "../config/env.js";
import Ministry from "../models/Ministry.js";

// Remplacement de la liste des ministères (demande de l'église,
// 13/10/2026) : Intercession, Formation, Jeunesse (Néos), Enfance,
// Évangélisation, Louange et adoration, Action sociale, Délivrance,
// Bergerie, Famille et bien-être, Femme sans limite — dans cet ordre.
//
// ------------------------------------------------------------------
// RÈGLES
// ------------------------------------------------------------------
// - SANS ÉCRITURE PAR DÉFAUT : affiche son plan et sort. `--apply`
//   pour exécuter. Idempotent : rejouable sans risque.
// - Un ministère dont le slug existe déjà est MIS À JOUR (titre,
//   description, image, ordre, couleur, publication). Ses responsables,
//   statistiques, témoignages, galerie et événements ne sont pas
//   touchés ; sa mission et sa vision ne sont renseignées que si elles
//   sont vides — ce qui a été saisi dans l'administration prime.
// - Un ministère absent de la liste est ARCHIVÉ (`status: "archived"`),
//   jamais supprimé : il disparaît du site public mais reste dans
//   l'administration, d'où il peut être republié.
//
// Les textes ci-dessous sont un point de départ, modifiables ensuite
// depuis /admin/ministeres. Les images sont des chemins vers `public/`
// (la base ne peut pas produire d'import traité par Vite).
//
// Après `--apply`, le site public ne change qu'à la reconstruction
// suivante (bouton « Publier » de l'administration, ou `npm run
// content` en local).
//
// Usage :
//   node src/scripts/replaceMinistries.js           # plan seul
//   node src/scripts/replaceMinistries.js --apply   # exécution

const APPLY = process.argv.includes("--apply");

const MINISTRIES = [
  {
    slug: "intercession",
    title: "Intercession",
    image: "/images/events/event-2.jpg",
    description:
      "Des hommes et des femmes qui se tiennent sur la brèche : prière pour l'Église, les familles, les malades et la nation, dans la persévérance et la foi.",
    mission:
      "Porter dans la prière les fardeaux de l'Église et de ses membres, soutenir chaque activité de l'Église par l'intercession et développer une culture de prière dans toute la communauté.",
    vision:
      "Une Église qui prie sans cesse, et dont chaque avancée est précédée et portée par la prière.",
  },
  {
    slug: "formation",
    title: "Formation",
    image: "/images/ministries/enseignement.jpg",
    description:
      "Enseignement biblique, discipolat et formation des serviteurs : faire grandir chaque croyant vers la maturité spirituelle et le préparer au service.",
    mission:
      "Enseigner fidèlement la Parole de Dieu, établir les croyants dans les fondements de la foi et former les serviteurs et les responsables avant leur mise en fonction.",
    vision:
      "Des disciples matures, stables et utiles dans le Royaume de Dieu, capables à leur tour de transmettre ce qu'ils ont reçu.",
  },
  {
    slug: "jeunesse",
    title: "Jeunesse (Néos)",
    image: "/images/ministries/jeunesse.jpg",
    description:
      "Néos rassemble les jeunes de l'Église pour grandir ensemble dans la foi, l'amitié fraternelle et le service, avec audace et passion pour Christ.",
    mission:
      "Accompagner les jeunes dans leur marche avec Dieu, les enraciner dans la Parole et les aider à découvrir et à développer les dons que Dieu a déposés en eux.",
    vision:
      "Une génération nouvelle, intègre et passionnée, qui révèle Christ dans son école, sa famille, son travail et sa société.",
  },
  {
    slug: "enfance",
    title: "Enfance",
    image: "/images/ministries/enfance.jpg",
    description:
      "L'École du dimanche et les activités des enfants : un cadre sûr et joyeux où les plus jeunes découvrent Jésus et apprennent à aimer la Parole.",
    mission:
      "Enseigner la Parole de Dieu aux enfants de manière adaptée à leur âge, veiller sur eux et accompagner les parents dans l'éducation spirituelle de leurs enfants.",
    vision:
      "Des enfants qui connaissent Dieu dès leur jeune âge et grandissent en sagesse, en stature et en grâce.",
  },
  {
    slug: "evangelisation",
    title: "Évangélisation",
    image: "/images/ministries/evangelisation.jpg",
    description:
      "Annoncer la bonne nouvelle de Jésus-Christ dans les quartiers, les familles et au-delà, et accueillir ceux qui répondent à l'appel.",
    mission:
      "Proclamer l'Évangile avec fidélité, organiser des sorties et des campagnes d'évangélisation, et conduire les nouvelles âmes vers l'accueil et le suivi.",
    vision:
      "Que chaque membre devienne un témoin, et que chaque âme gagnée soit accompagnée jusqu'à la maturité.",
  },
  {
    slug: "louange-adoration",
    title: "Louange et adoration",
    image: "/images/ministries/louange-hero.jpg",
    description:
      "Conduire l'assemblée dans la présence de Dieu par le chant, la musique et l'adoration, avec excellence et dans un esprit de consécration.",
    mission:
      "Préparer et conduire la louange et l'adoration lors des cultes et des rencontres, et former des chantres et des musiciens consacrés.",
    vision:
      "Une Église où l'adoration ouvre la voie à la présence et à la puissance de Dieu.",
  },
  {
    slug: "action-sociale",
    title: "Action sociale",
    image: "/images/ministries/sociale.jpg",
    description:
      "Manifester l'amour de Christ par des actes concrets : soutien aux personnes vulnérables, aide aux familles et actions de solidarité.",
    mission:
      "Identifier les besoins des membres et de la communauté, organiser l'entraide et porter assistance aux personnes en difficulté.",
    vision:
      "Une Église dont l'amour se voit autant qu'il s'entend, et qui impacte la société par la compassion.",
  },
  {
    slug: "delivrance",
    title: "Délivrance",
    image: "/images/ministries/delivrance.jpg",
    description:
      "Prière et accompagnement des personnes en quête de libération et de restauration, par la puissance de la Parole et du Saint-Esprit.",
    mission:
      "Prier pour les personnes liées ou éprouvées, les accompagner avec sagesse et discrétion, et les conduire vers une vie libre et stable en Christ.",
    vision:
      "Des vies libérées, restaurées et affermies, qui marchent dans la liberté que Christ a acquise.",
  },
  {
    slug: "bergerie",
    title: "Bergerie",
    image: "/images/ministries/homegroup.jpg",
    description:
      "Les bergeries sont des groupes de proximité où chaque membre est connu, suivi et accompagné par un berger, pour qu'aucune âme ne marche seule.",
    mission:
      "Intégrer chaque membre dans une bergerie, assurer le suivi pastoral de proximité et favoriser la communion fraternelle entre les membres.",
    vision:
      "Une Église où chaque personne appartient à une famille spirituelle qui la connaît, la soutient et la fait grandir.",
  },
  {
    slug: "famille-bien-etre",
    title: "Famille et bien-être",
    image: "/images/ministries/famille.jpg",
    description:
      "Accompagner les couples et les familles, et prendre soin de l'équilibre de chacun : vie de couple, parentalité, santé et bien-être, à la lumière de la Parole.",
    mission:
      "Fortifier les foyers par l'enseignement et l'accompagnement, soutenir les familles dans leurs difficultés et promouvoir le bien-être spirituel, émotionnel et physique des membres.",
    vision:
      "Des familles solides et épanouies, qui reflètent l'amour de Dieu et deviennent des lieux de bénédiction pour leur entourage.",
  },
  {
    slug: "femme-sans-limite",
    title: "Femme sans limite",
    image: "/images/media/temoignage4.jpg",
    description:
      "Le ministère des femmes : un lieu de prière, d'enseignement et de fraternité où chaque femme est encouragée à vivre pleinement l'appel de Dieu, sans limite.",
    mission:
      "Édifier les femmes dans la Parole et la prière, les accompagner dans toutes les saisons de leur vie et les encourager à exercer leurs dons au service de Dieu, de leur famille et de la société.",
    vision:
      "Des femmes affermies en Christ, épanouies et influentes, qui révèlent Dieu là où elles sont placées.",
  },
];

const isBlank = (section) => !section?.description?.trim();

const run = async () => {
  validateEnv();

  await mongoose.connect(env.MONGODB_URI);

  console.log(
    APPLY
      ? "\n  EXÉCUTION (--apply)\n"
      : "\n  PLAN SEUL — rien n'est écrit. Relancer avec --apply.\n"
  );

  const keep = new Set(MINISTRIES.map((m) => m.slug));

  let created = 0;
  let updated = 0;
  let archived = 0;

  for (const [index, data] of MINISTRIES.entries()) {
    const base = {
      title: data.title,
      description: data.description,
      image: data.image,
      order: index + 1,
      color: index % 2 === 0 ? "green" : "gold",
      status: "published",
    };

    const existing = await Ministry.findOne({ slug: data.slug });

    if (!existing) {
      console.log(`  + ${data.slug} — création (« ${data.title} »)`);

      if (APPLY) {
        await Ministry.create({
          slug: data.slug,
          ...base,
          mission: { title: "Notre mission", description: data.mission },
          vision: { title: "Notre vision", description: data.vision },
        });
      }

      created += 1;

      continue;
    }

    console.log(
      `  ~ ${data.slug} — mise à jour (« ${existing.title} » → « ${data.title} »)`
    );

    if (APPLY) {
      existing.set(base);

      if (isBlank(existing.mission)) {
        existing.mission = {
          title: "Notre mission",
          description: data.mission,
        };
      }

      if (isBlank(existing.vision)) {
        existing.vision = {
          title: "Notre vision",
          description: data.vision,
        };
      }

      await existing.save();
    }

    updated += 1;
  }

  const others = await Ministry.find({
    slug: { $nin: [...keep] },
    status: { $ne: "archived" },
  });

  for (const ministry of others) {
    console.log(`  - ${ministry.slug} — archivé (« ${ministry.title} »)`);

    if (APPLY) {
      ministry.status = "archived";

      await ministry.save();
    }

    archived += 1;
  }

  console.log(
    `\n  ${created} à créer, ${updated} à mettre à jour, ${archived} à archiver` +
      (APPLY ? " — FAIT." : " — rien n'a été écrit.")
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`\n[ministères] ÉCHEC : ${error.message}\n`);

  await mongoose.disconnect().catch(() => {});

  process.exit(1);
});
