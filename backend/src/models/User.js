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

    email: {
      type: String,
      required: [true, "L'e-mail est obligatoire."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Adresse e-mail invalide.",
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

    role: {
      type: String,
      enum: ["admin", "editor"],
      default: "editor",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: Date,

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
  },
  { timestamps: true }
);

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
// puis renvoie le document, la sérialisation JSON retire le hash.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;

    return ret;
  },
});

export default mongoose.model("User", userSchema);
