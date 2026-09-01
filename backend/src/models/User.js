import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Administrateurs du site. Volontairement minimal : ce modèle sert à
// protéger l'espace d'administration, pas à gérer des profils publics.
// Les membres de la communauté sont une entité distincte (`Member`),
// car ils n'ont ni mot de passe ni accès à l'administration.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom est obligatoire."],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    // Obligatoire pour admin/editor, absent pour les agents de terrain
    // (voir `registrationNumber` ci-dessous et le hook de validation en
    // bas de fichier) — `sparse` : plusieurs comptes sans e-mail ne
    // doivent pas se heurter à l'unicité sur la valeur `null`.
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
      ],
    },

    // Identifiant de connexion des agents de terrain (soa, cana,
    // coordinateur_bergeries, pasteur, social_*) : ces comptes n'ont
    // souvent pas d'adresse e-mail facilement accessible, mais
    // connaissent tous leur matricule de membre. Même forme que
    // `Member.registrationNumber` (voir registrationNumber.service.js) —
    // vérifié à la création contre un membre existant par
    // agent.service.js, pas au niveau du schéma (ce champ n'a pas
    // besoin de connaître Member).
    registrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      match: [
        /^[1-5][A-Z]{2}\d{2}\d{3}[A-Z]$/,
        "Matricule invalide.",
      ],
    },

    // `select: false` : le hash n'est jamais renvoyé par défaut, même
    // si un controller oublie de l'exclure.
    password: {
      type: String,
      required: [true, "Le mot de passe est obligatoire."],
      minlength: [
        12,
        "Le mot de passe doit faire au moins 12 caractères.",
      ],
      select: false,
    },

    // "soa"/"cana"/"coordinateur_bergeries"/"pasteur" : rôles du module
    // Nouvelles Âmes (voir NewSoul.js). Chaque rôle a un jeu de
    // permissions fixe, appliqué via requireRole et le filtrage dans
    // newSoul.service.js — pas de permissions par ressource ici.
    // "social_admin"/"social_agent"/"social_approver"/"social_viewer" :
    // rôles du module Service Social (cotisations, caisse — voir
    // SocialContribution.js). `social_approver` n'a pas encore d'usage
    // concret (réservé au futur workflow de validation des aides
    // sociales) : ajouté dès maintenant pour éviter une seconde
    // migration d'enum quand ce workflow arrivera.
    // "responsable_ecole_dimanche"/"moniteur" : rôles du module Enfants
    // (École du dimanche — voir Child.js, MonitorAssignment.js). Un
    // moniteur est TOUJOURS un membre adulte existant : ce compte porte
    // uniquement sa connexion, son identité reste sa fiche `Member`,
    // retrouvée par `registrationNumber` (même montage que les comptes
    // agents ci-dessus).
    role: {
      type: String,
      enum: [
        "admin",
        "editor",
        "soa",
        "cana",
        "coordinateur_bergeries",
        "pasteur",
        "social_admin",
        "social_agent",
        "social_approver",
        "social_viewer",
        "responsable_ecole_dimanche",
        "moniteur",
      ],
      default: "editor",
    },

    // PORTÉE PAR ÉGLISE — facultative, et c'est délibéré.
    //
    // Renseignée, elle PLAFONNE ce que le compte peut voir ; vide, elle
    // ne restreint rien. Les comptes existants n'en ont pas, donc ce
    // champ n'a aucun effet sur eux : un `admin` continue de voir les
    // cinq églises.
    //
    // N'ÉLARGIT JAMAIS un droit : c'est un filtre appliqué en plus du
    // rôle, jamais à sa place. Un `moniteur` dont la portée serait
    // l'église 1 n'a pas pour autant accès à toutes les classes de
    // cette église — l'accès aux classes reste décidé par
    // `resolveMonitorAccess` (voir monitor.service.js).
    church: { type: Number, min: 1, max: 5 },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: Date,

    // MOT DE PASSE TEMPORAIRE
    //
    // Levé quand un administrateur crée l'accès d'un moniteur ou
    // réinitialise son mot de passe : la valeur posée est connue de
    // l'administrateur, elle ne peut donc pas rester le mot de passe
    // du titulaire.
    //
    // Tant qu'il est levé, `login` ne délivre PAS de jeton de session
    // (voir auth.service.js) mais un jeton de portée
    // `password_change`, qui n'ouvre qu'une seule route. Le drapeau
    // n'est donc pas une simple invite affichée par l'interface : rien
    // d'autre n'est accessible tant qu'il n'est pas retombé.
    //
    // `default: false` : les comptes existants (admin, editor, agents,
    // Service Social) ne sont pas concernés et se connectent
    // exactement comme avant.
    passwordChangeRequired: {
      type: Boolean,
      default: false,
    },

    // Dernier changement de mot de passe PAR SON TITULAIRE. Ni une
    // création de compte ni une réinitialisation par l'administration
    // ne le renseignent — c'est précisément ce qui permet à
    // l'administration d'afficher « mot de passe jamais changé ».
    passwordChangedAt: Date,

    // VERROUILLAGE DE COMPTE
    //
    // Le rate limiting est lié à l'adresse IP : il freine une attaque
    // depuis une machine, mais pas une attaque distribuée qui vise un
    // compte précis depuis plusieurs adresses. Le compteur ci-dessous
    // est lié au COMPTE, ce qui couvre ce cas.
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    lockedUntil: {
      type: Date,
      select: false,
    },

    // DOUBLE AUTHENTIFICATION (TOTP)
    //
    // Le mot de passe seul ne protège plus grand-chose : il fuite par
    // hameçonnage, réutilisation d'un mot de passe d'un autre site, ou
    // logiciel espion. Un second facteur rend ces trois scénarios
    // insuffisants pour entrer.
    twoFactor: {
      enabled: { type: Boolean, default: false },

      // `select: false` sur les deux secrets : ils ne doivent jamais
      // partir dans une réponse, même en cas d'oubli dans un
      // controller. Quiconque lit `secret` peut générer les codes.
      secret: { type: String, select: false },

      // Secret en cours d'installation, tant que l'utilisateur n'a pas
      // prouvé qu'il l'a bien enregistré dans son application. Le
      // séparer du secret actif évite de casser une 2FA qui fonctionne
      // parce qu'une nouvelle configuration a été commencée puis
      // abandonnée.
      pendingSecret: { type: String, select: false },

      activatedAt: Date,

      // Dernier pas de temps accepté, pour interdire de rejouer un
      // code encore valide. Voir `verifyTotp` dans utils/totp.js.
      lastUsedStep: { type: Number, select: false },

      // Codes de secours à usage unique, stockés hachés. `usedAt`
      // plutôt qu'une suppression : l'utilisateur voit combien il lui
      // en reste, et la trace d'un usage subsiste.
      recoveryCodes: {
        type: [
          {
            _id: false,
            codeHash: String,
            usedAt: Date,
          },
        ],
        select: false,
        default: [],
      },
    },
  },
  { timestamps: true }
);

// Comptes de gestion classique : connexion par e-mail, comme avant ce
// changement. Tout le reste (agents de terrain, y compris les rôles
// Service Social) se connecte par matricule — voir `registrationNumber`
// ci-dessus et auth.service.js#login.
const EMAIL_LOGIN_ROLES = ["admin", "editor"];

// Exactement un identifiant de connexion selon le rôle, jamais les deux
// absents ni un mélange incohérent (ex. un agent avec un e-mail mais
// sans matricule ne pourrait jamais se connecter, sans qu'aucune
// validation ne le signale à la création).
userSchema.pre("validate", function (next) {
  const needsEmail = EMAIL_LOGIN_ROLES.includes(this.role);

  if (needsEmail && !this.email) {
    this.invalidate("email", "L'e-mail est obligatoire pour ce rôle.");
  }

  if (!needsEmail && !this.registrationNumber) {
    this.invalidate(
      "registrationNumber",
      "Le matricule est obligatoire pour ce rôle."
    );
  }

  next();
});

// Le hachage est fait au niveau du modèle : impossible de l'oublier
// depuis un controller ou un script d'amorçage.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);

  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Verrouillage : 5 échecs consécutifs bloquent le compte 15 minutes.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

userSchema.methods.isLocked = function () {
  return Boolean(
    this.lockedUntil && this.lockedUntil > new Date()
  );
};

userSchema.methods.registerFailedLogin = async function () {
  const attempts = (this.failedLoginAttempts ?? 0) + 1;

  const update = { failedLoginAttempts: attempts };

  if (attempts >= MAX_ATTEMPTS) {
    update.lockedUntil = new Date(
      Date.now() + LOCK_MINUTES * 60 * 1000
    );

    update.failedLoginAttempts = 0;
  }

  await this.updateOne(update);
};

userSchema.methods.registerSuccessfulLogin = async function () {
  await this.updateOne({
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  });
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: String(email).toLowerCase() });
};

// Ceinture et bretelles : même si un appel fait `.select('+password')`
// puis renvoie le document, la sérialisation JSON retire le hash et
// tout ce qui touche au second facteur. Seul l'état d'activation
// survit — c'est la seule information dont l'interface a besoin.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;

    if (ret.twoFactor) {
      ret.twoFactor = {
        enabled: Boolean(ret.twoFactor.enabled),
        activatedAt: ret.twoFactor.activatedAt,
      };
    }

    return ret;
  },
});

export default mongoose.model("User", userSchema);
