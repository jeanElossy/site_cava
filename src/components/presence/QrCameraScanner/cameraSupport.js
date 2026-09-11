// Logique pure du scanner caméra : QUOI demander au navigateur, et QUOI
// dire à l'agent quand ça échoue. Aucune dépendance à React ni au DOM
// réel — tout ce qui dépend de l'appareil est passé en paramètre, ce qui
// rend chaque règle testable (voir cameraSupport.test.js).
// QrCameraScanner.jsx ne fait qu'orchestrer ces fonctions.

// ─── Contraintes getUserMedia ──────────────────────────────────────────

// Un QR occupe une petite part du cadre, et c'est le nombre de pixels
// QU'IL couvre qui décide si jsQR le lit. Le coût de calcul, lui, ne
// suit pas la définition du flux : le décodage travaille sur un carré
// réduit (voir DECODE_SIZE dans QrCameraScanner.jsx).
const idealResolution = () => ({
  width: { ideal: 1280 },
  height: { ideal: 720 },
});

// Tentatives de `getUserMedia`, de la plus précise à la plus permissive.
//
// Jamais de `facingMode: { exact: "environment" }` : cette contrainte
// fait échouer l'ouverture (OverconstrainedError) sur les appareils qui
// n'étiquettent pas leurs objectifs, alors qu'ils ont bien une caméra
// arrière utilisable. `ideal` obtient la caméra arrière quand elle
// existe, et une caméra quelconque sinon.
//
// Seul `deviceId` est en `exact` : c'est la caméra que l'agent a
// explicitement choisie. Si elle n'est plus disponible (identifiants
// renouvelés par Safari, par exemple), il faut le savoir et retomber sur
// l'automatique — pas obtenir en silence une autre caméra qu'elle.
export const buildConstraintAttempts = (preferredDeviceId) => {
  const attempts = [];

  if (preferredDeviceId) {
    attempts.push({
      label: "caméra choisie",
      constraints: {
        video: { deviceId: { exact: preferredDeviceId }, ...idealResolution() },
        audio: false,
      },
    });
  }

  attempts.push({
    label: "caméra arrière (ideal)",
    constraints: {
      video: { facingMode: { ideal: "environment" }, ...idealResolution() },
      audio: false,
    },
  });

  // Dernier recours, sans aucune contrainte : certains navigateurs
  // anciens refusent jusqu'à la simple présence de width/height.
  attempts.push({
    label: "n'importe quelle caméra",
    constraints: { video: true, audio: false },
  });

  return attempts;
};

// ─── Choix de la caméra ────────────────────────────────────────────────

// Libellés relevés sur les appareils : Chrome Android « camera2 0,
// facing back », Safari iOS « Caméra arrière » / « Back Dual Wide
// Camera ». Les libellés sont VIDES tant que l'autorisation n'est pas
// accordée : ces fonctions ne servent qu'après un premier flux obtenu.
export const isBackCameraLabel = (label = "") =>
  /back|rear|arrière|arriere|environment/i.test(label);

export const isFrontCameraLabel = (label = "") =>
  /front|avant|facetime|selfie/i.test(label);

// Objectifs secondaires à éviter pour lire une carte tenue à 15 cm :
// ultra grand-angle, téléobjectif et capteurs de profondeur font mal ou
// pas du tout la mise au point de près.
const isSecondaryLens = (label = "") => /ultra|tele|zoom|macro|depth/i.test(label);

// Caméra arrière vers laquelle basculer quand le navigateur a ouvert la
// caméra AVANT malgré `facingMode: ideal environment` (appareils qui
// ignorent la contrainte). `null` quand il n'y a rien à corriger : la
// caméra obtenue est déjà une arrière, ou on ne sait pas la situer (une
// webcam d'ordinateur n'est ni avant ni arrière — on la garde).
export const findBackCameraSwitch = (videoInputs, current) => {
  const isFront =
    current?.facingMode === "user" || isFrontCameraLabel(current?.label);

  if (!isFront) return null;

  const backs = videoInputs.filter(
    (device) => device.deviceId && isBackCameraLabel(device.label)
  );
  const main = backs.find((device) => !isSecondaryLens(device.label)) ?? backs[0];

  return main && main.deviceId !== current?.deviceId ? main.deviceId : null;
};

// Caméra suivante pour le bouton « Changer de caméra », en boucle.
export const nextCameraId = (videoInputs, currentDeviceId) => {
  const ids = videoInputs.map((device) => device.deviceId).filter(Boolean);

  if (ids.length < 2) return null;

  const index = ids.indexOf(currentDeviceId);

  return ids[(index + 1) % ids.length];
};

// ─── Environnement ─────────────────────────────────────────────────────

// iPadOS se présente comme un Mac : seul le tactile le trahit.
export const detectPlatform = (userAgent = "", maxTouchPoints = 0) => {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";

  return "other";
};

// Nom lisible du navigateur, pour le diagnostic uniquement : aucune
// décision n'est prise sur cette base (détecter les capacités, pas les
// marques). L'ordre compte — Samsung, Edge ou Opera s'annoncent AUSSI
// comme Chrome, et Chrome iOS comme Safari.
const BROWSER_RULES = [
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/MiuiBrowser\/(\d+)/, "Mi Browser"],
  [/EdgA?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/CriOS\/(\d+)/, "Chrome iOS"],
  [/FxiOS\/(\d+)/, "Firefox iOS"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]* .*Safari/, "Safari"],
];

export const describeBrowser = (userAgent = "") => {
  for (const [pattern, name] of BROWSER_RULES) {
    const match = pattern.exec(userAgent);

    if (match) {
      const webView = /\bwv\b/.test(userAgent) ? " (WebView)" : "";

      return `${name} ${match[1]}${webView}`;
    }
  }

  return "inconnu";
};

// Un navigateur intégré à une autre application (le lien ouvert depuis
// WhatsApp, Facebook, Messenger…) n'a très souvent AUCUN accès à la
// caméra, quelles que soient les autorisations accordées : le refus ne
// vient pas du site mais de l'application hôte. Cas fréquent ici, le QR
// de service circulant par WhatsApp — et invisible pour l'agent, qui
// voit un navigateur ordinaire.
export const isInAppBrowser = (
  userAgent = "",
  { secureContext = true, hasGetUserMedia = true } = {}
) => {
  // « wv » marque une WebView Android ; les autres sont les navigateurs
  // intégrés qui s'annoncent explicitement.
  if (/\bwv\b|FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger|WhatsApp/i.test(userAgent)) {
    return true;
  }

  // Android sans `getUserMedia` en contexte sécurisé : aucun navigateur
  // Android à jour n'est dans ce cas, c'est la signature d'une WebView
  // intégrée qui n'expose tout simplement pas l'API.
  return /Android/i.test(userAgent) && secureContext && !hasGetUserMedia;
};

// Ce que la Permissions-Policy du DOCUMENT autorise. `false` signifie
// que le site lui-même interdit la caméra (en-tête HTTP) : aucune
// autorisation accordée par l'agent n'y changera rien, Chrome refuse
// avant même d'afficher la demande. C'était la cause de la panne
// Android (vercel.json servait `camera=()`). `null` = navigateur qui
// n'expose pas l'information (Safari, Firefox).
export const readCameraPolicy = (doc) => {
  try {
    const policy = doc?.permissionsPolicy ?? doc?.featurePolicy;

    if (typeof policy?.allowsFeature !== "function") return null;

    return policy.allowsFeature("camera");
  } catch {
    return null;
  }
};

// État de l'autorisation, À TITRE INDICATIF uniquement : il sert à
// savoir si la caméra peut démarrer sans un geste de l'agent, jamais à
// conclure qu'elle fonctionnera (seul `getUserMedia` le dit). Renvoie
// le PermissionStatus, ou `null` si l'API ou le nom `camera` ne sont pas
// pris en charge (Firefox, anciens Safari).
export const queryCameraPermission = async (nav) => {
  try {
    return (await nav?.permissions?.query?.({ name: "camera" })) ?? null;
  } catch {
    return null;
  }
};

// ─── Erreurs ───────────────────────────────────────────────────────────

const PERMISSION_ERRORS = new Set([
  "NotAllowedError",
  "PermissionDeniedError", // Chrome d'avant la normalisation
  "SecurityError",
]);

// Un refus d'autorisation ne se rejoue pas avec d'autres contraintes :
// insister redemanderait, voire réafficherait une invite que l'agent
// vient de refuser.
export const isPermissionError = (error) => PERMISSION_ERRORS.has(error?.name);

export const PERMISSION_KINDS = new Set([
  "policy",
  "in-app",
  "dismissed",
  "denied-system",
  "denied",
]);

// Cause d'un échec de `getUserMedia`, d'après son nom — qui varie selon
// le navigateur et sa version, d'où les alias. `context` apporte ce que
// le nom seul ne dit pas : un NotAllowedError peut venir de l'agent, du
// système, du navigateur intégré ou du site lui-même.
export const classifyCameraError = (
  error,
  { policyAllowsCamera = null, inAppBrowser = false, secureContext = true } = {}
) => {
  const name = error?.name ?? "";
  const text = String(error?.message ?? "");

  if (PERMISSION_ERRORS.has(name)) {
    if (policyAllowsCamera === false) return "policy";
    if (inAppBrowser) return "in-app";
    // Libellés de Chrome : « Permission dismissed » quand la demande a
    // été fermée sans réponse, « Permission denied by system » quand
    // c'est Android qui refuse la caméra à Chrome lui-même.
    if (/dismiss/i.test(text)) return "dismissed";
    if (/system/i.test(text)) return "denied-system";

    return "denied";
  }

  switch (name) {
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "not-found";
    case "NotReadableError":
    case "TrackStartError":
      return "busy";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "overconstrained";
    case "AbortError":
      return "aborted";
    case "TypeError":
      // Hors contexte sécurisé, certains navigateurs rejettent en
      // TypeError au lieu de ne pas exposer l'API.
      return secureContext ? "unknown" : "insecure";
    default:
      return "unknown";
  }
};

const RETRY = "touchez « Réessayer »";

const DENIED_MESSAGES = {
  android: `L'accès à la caméra est refusé pour ce site. Touchez l'icône à gauche de l'adresse, en haut de l'écran, puis Autorisations → Caméra → Autoriser, et ${RETRY}.`,
  ios: `L'accès à la caméra est refusé. Dans Safari : touchez « aA » dans la barre d'adresse → Réglages du site web → Appareil photo → Autoriser. Avec Chrome : Réglages de l'iPhone → Chrome → Appareil photo. Puis ${RETRY}.`,
  other: `L'accès à la caméra est refusé pour ce site. Autorisez-la depuis l'icône à gauche de l'adresse, puis ${RETRY}.`,
};

const SYSTEM_DENIED_MESSAGES = {
  android: `Le téléphone interdit la caméra à votre navigateur. Ouvrez Paramètres → Applications → Chrome → Autorisations → Appareil photo → Autoriser, revenez ici et ${RETRY}.`,
  ios: `L'iPhone interdit la caméra à ce navigateur. Ouvrez Réglages → Safari (ou Chrome) → Appareil photo → Autoriser, revenez ici et ${RETRY}.`,
  other: `Le système interdit la caméra au navigateur. Autorisez-la dans les réglages de l'appareil, puis ${RETRY}.`,
};

// Message affiché à l'agent : ce qui se passe, et surtout ce qu'il doit
// FAIRE. Jamais de consigne « autorisez la caméra » quand l'autorisation
// n'est pas en cause — c'est ce qui envoyait les agents Android fouiller
// des réglages déjà corrects.
export const cameraFailureMessage = (kind, { platform = "other" } = {}) => {
  switch (kind) {
    case "policy":
      return "La caméra est bloquée par la configuration du site, pas par votre téléphone : aucun réglage ne la débloquera de votre côté. Prévenez l'administrateur du site.";
    case "in-app":
      return "Cette page est ouverte dans le navigateur interne d'une autre application (WhatsApp, Facebook…), qui bloque la caméra — l'autorisation accordée à Chrome n'y change rien. Touchez le menu ⋮ en haut à droite, puis « Ouvrir dans le navigateur » ou « Ouvrir dans Chrome », et reconnectez-vous.";
    case "dismissed":
      return `La demande d'autorisation a été fermée sans réponse. Touchez « Réessayer » puis « Autoriser ». Si elle ne réapparaît plus, autorisez la caméra depuis l'icône à gauche de l'adresse.`;
    case "denied-system":
      return SYSTEM_DENIED_MESSAGES[platform] ?? SYSTEM_DENIED_MESSAGES.other;
    case "denied":
      return DENIED_MESSAGES[platform] ?? DENIED_MESSAGES.other;
    case "insecure":
      return "La caméra exige une connexion sécurisée (https). Ouvrez le site en https, pas par son adresse IP.";
    case "unsupported":
      return "Votre navigateur ne permet pas l'utilisation de la caméra. Ouvrez cette page dans Google Chrome (Android) ou Safari (iPhone).";
    case "not-found":
      return "Aucune caméra disponible sur cet appareil.";
    case "overconstrained":
      return "Aucune caméra compatible n'a été trouvée sur cet appareil.";
    case "busy":
      return `La caméra est déjà utilisée par une autre application (appareil photo, appel vidéo…). Fermez cette application, puis ${RETRY}.`;
    case "aborted":
      return `Le démarrage de la caméra a été interrompu. ${RETRY[0].toUpperCase()}${RETRY.slice(1)}.`;
    case "ended":
      return `La caméra s'est arrêtée (appel entrant, autre application, écran verrouillé…). ${RETRY[0].toUpperCase()}${RETRY.slice(1)}.`;
    case "playback":
      return `La caméra est ouverte mais aucune image n'arrive. ${RETRY[0].toUpperCase()}${RETRY.slice(1)}.`;
    default:
      return `La caméra n'a pas pu démarrer. ${RETRY[0].toUpperCase()}${RETRY.slice(1)}.`;
  }
};

// Ce que l'agent recopie sous le message (« Détail technique »), et ce
// que le diagnostic affiche : nom, message et contrainte fautive.
export const describeCameraError = (error) => ({
  name: error?.name || "",
  message: error?.message || "",
  constraint: error?.constraint || "",
});

export const formatCameraErrorDetail = (error, kind) => {
  const { name, message, constraint } = describeCameraError(error);
  const parts = [name];

  if (message && message !== name) parts.push(message);
  if (constraint) parts.push(`contrainte : ${constraint}`);
  if (kind === "policy") parts.push("Permissions-Policy");

  return parts.filter(Boolean).join(" · ") || kind;
};
