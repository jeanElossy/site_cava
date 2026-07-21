import crypto from "node:crypto";

// TOTP — mots de passe à usage unique basés sur le temps (RFC 6238).
//
// C'est le standard derrière Google Authenticator, Authy, 1Password,
// Microsoft Authenticator… Aucune dépendance : l'algorithme tient en
// une centaine de lignes et repose entièrement sur `node:crypto`.
//
// Pourquoi TOTP plutôt que des codes par SMS : le SMS est
// interceptable (échange de carte SIM, réseau opérateur) et le NIST le
// déconseille depuis 2016. TOTP fonctionne hors ligne, ne coûte rien,
// et le secret ne quitte jamais l'appareil après l'installation.

// Alphabet base32 (RFC 4648). Ni 0/1/8 ni I/L/O : ces caractères se
// confondent à la lecture, et un secret se recopie parfois à la main.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Un pas de 30 secondes, 6 chiffres : les valeurs par défaut de la
// RFC, et les seules que toutes les applications d'authentification
// gèrent sans configuration particulière.
export const STEP_SECONDS = 30;
const DIGITS = 6;

export const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

export const base32Decode = (input) => {
  const clean = String(input ?? "")
    .toUpperCase()
    .replace(/[=\s-]/g, "");

  let bits = 0;
  let value = 0;

  const bytes = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error("Secret TOTP invalide.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

// 20 octets = 160 bits, la taille recommandée par la RFC pour
// HMAC-SHA1.
export const generateSecret = () =>
  base32Encode(crypto.randomBytes(20));

// HOTP (RFC 4226) : la brique sur laquelle TOTP est bâti. La seule
// différence entre les deux est la provenance du compteur — un
// incrément pour HOTP, le temps écoulé pour TOTP.
const hotp = (key, counter) => {
  const message = Buffer.alloc(8);

  message.writeBigUInt64BE(BigInt(counter));

  const digest = crypto
    .createHmac("sha1", key)
    .update(message)
    .digest();

  // Troncature dynamique : les 4 derniers bits du condensat désignent
  // l'endroit où lire les 4 octets qui produiront le code.
  const offset = digest[digest.length - 1] & 0x0f;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
};

export const currentStep = (at = Date.now()) =>
  Math.floor(at / 1000 / STEP_SECONDS);

// Comparaison à temps constant.
//
// Un `===` sur des chaînes s'arrête au premier caractère différent :
// le temps de réponse trahit alors le nombre de chiffres corrects, ce
// qui permet de reconstituer le code chiffre par chiffre au lieu de
// tester le million de combinaisons.
const equals = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
};

// Vérifie un code et renvoie le PAS DE TEMPS correspondant, ou `null`.
//
// Renvoyer le pas plutôt qu'un booléen n'est pas un détail : l'appelant
// l'enregistre pour interdire la réutilisation du même code pendant sa
// fenêtre de validité (voir `User.twoFactor.lastUsedStep`). Sans cela,
// un code intercepté reste rejouable une bonne minute.
//
// `window = 1` tolère un pas avant et après, soit environ 90 secondes
// au total : de quoi absorber une horloge de téléphone légèrement
// décalée sans élargir inutilement la surface d'attaque.
export const verifyTotp = (
  code,
  secret,
  { window = 1, at = Date.now() } = {}
) => {
  const clean = String(code ?? "").replace(/\D/g, "");

  if (clean.length !== DIGITS) return null;

  let key;

  try {
    key = base32Decode(secret);
  } catch {
    return null;
  }

  if (key.length === 0) return null;

  const step = currentStep(at);

  for (let drift = -window; drift <= window; drift += 1) {
    if (equals(hotp(key, step + drift), clean)) {
      return step + drift;
    }
  }

  return null;
};

// URI standard lue par les applications d'authentification. C'est ce
// que contient le QR code.
export const otpauthURL = ({ secret, account, issuer }) => {
  const label = `${encodeURIComponent(
    issuer
  )}:${encodeURIComponent(account)}`;

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
};

// ------------------------------------------------------------------
// Codes de secours
// ------------------------------------------------------------------
//
// Sans eux, un téléphone perdu ou réinitialisé signifie un compte
// définitivement inaccessible — et, dans un projet à un seul
// administrateur, un site que plus personne ne peut mettre à jour.

const RECOVERY_COUNT = 10;
const RECOVERY_LENGTH = 10;

export const generateRecoveryCodes = (count = RECOVERY_COUNT) =>
  Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(RECOVERY_LENGTH);

    const body = Array.from(bytes, (byte) => ALPHABET[byte & 31])
      .join("")
      .slice(0, RECOVERY_LENGTH);

    // Groupé par 5 : plus lisible à la transcription.
    return `${body.slice(0, 5)}-${body.slice(5)}`;
  });

export const normalizeRecoveryCode = (code) =>
  String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");

// SHA-256 et non bcrypt, volontairement.
//
// Bcrypt protège des secrets à faible entropie (mots de passe humains)
// contre une attaque hors ligne. Un code de secours fait 50 bits
// d'aléa pur : il est hors de portée d'une attaque par force brute
// quelle que soit la vitesse de hachage. Bcrypt n'apporterait donc
// rien ici, mais coûterait dix comparaisons lentes à chaque tentative
// — soit une porte ouverte au déni de service.
export const hashRecoveryCode = (code) =>
  crypto
    .createHash("sha256")
    .update(normalizeRecoveryCode(code))
    .digest("hex");
