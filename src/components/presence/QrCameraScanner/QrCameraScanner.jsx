import { useCallback, useEffect, useRef, useState } from "react";

import jsQR from "jsqr";

import { Camera, CameraOff, Loader2, RefreshCw, SwitchCamera } from "lucide-react";

import CameraDiagnostics from "./CameraDiagnostics";
import { CAMERA_DIAGNOSTICS, logCamera, setCameraFacts } from "./cameraDiagnostics";
import {
  buildConstraintAttempts,
  cameraFailureMessage,
  classifyCameraError,
  describeBrowser,
  describeCameraError,
  detectPlatform,
  findBackCameraSwitch,
  formatCameraErrorDetail,
  isInAppBrowser,
  isPermissionError,
  nextCameraId,
  PERMISSION_KINDS,
  queryCameraPermission,
  readCameraPolicy,
} from "./cameraSupport";

import "./QrCameraScanner.scss";

// Lecteur de QR code par caméra, réutilisé à deux endroits du badgeage
// des présences : la connexion agent (QR de sécurité, une seule lecture)
// et le scanner continu de cartes membres (voir docs/superpowers/specs/
// 2026-08-04-badgeage-presences-design.md). Aucune dépendance serveur :
// tout le décodage a lieu dans le navigateur (`jsqr`).
//
// PANNE ANDROID (septembre 2026) — la cause n'était PAS dans ce fichier :
// vercel.json servait `Permissions-Policy: camera=()`, qui interdit la
// caméra au site lui-même. Chrome (donc Android) applique cet en-tête et
// rejette `getUserMedia` en NotAllowedError SANS afficher de demande ;
// Safari l'ignore, d'où un iPhone qui fonctionnait. Si la panne revient,
// le message « bloquée par la configuration du site » la signale
// directement (voir readCameraPolicy dans cameraSupport.js).

// Fréquence de décodage : 5 images/s suffit à un scan perçu comme
// instantané, pour un coût CPU bien inférieur à un décodage à chaque
// image vidéo (jusqu'à 60/s).
const SCAN_INTERVAL_MS = 200;

// Résolution de dessin de l'aperçu visible : carrée, indépendante de la
// taille d'affichage réelle (mise à l'échelle par le CSS).
const PREVIEW_SIZE = 480;

// Côté du carré RÉELLEMENT décodé, indépendant de la définition du
// flux. jsQR travaille en JavaScript sur le fil principal, son coût est
// proportionnel au nombre de pixels : un Android en 1080p saturerait le
// fil principal. 512 px suffisent à lire un QR qui occupe le cadre.
const DECODE_SIZE = 512;

// Pause du scanner (`active` à false) : la caméra reste ouverte ce
// délai avant d'être libérée. Le scanner se met en pause à CHAQUE badge
// (le temps d'afficher le résultat, 1,8 s) : couper puis rouvrir la
// caméra des centaines de fois par culte coûte une seconde à chaque
// reprise, et sur Android une réouverture trop rapprochée échoue parfois
// en NotReadableError, le temps que le matériel se libère.
const RELEASE_DELAY_MS = 15000;

// Sans réponse de `getUserMedia` passé ce délai (demande d'autorisation
// masquée, caméra qui ne rend jamais la main), on propose « Réessayer »
// au lieu de laisser l'agent devant un sablier.
const SLOW_START_MS = 10000;

// Délai laissé au flux pour produire une première image après `play()`.
const FIRST_FRAME_TIMEOUT_MS = 4000;

// Le même QR n'est relu qu'après avoir quitté le cadre pendant ce nombre
// de passes (1 s). Depuis que la caméra reste ouverte entre deux
// badges, un badge encore devant l'objectif serait relu dès la reprise —
// et un scan de badge invité crée une présence à chaque fois.
const REPEAT_AFTER_ABSENT_PASSES = 5;

// `HTMLMediaElement.HAVE_CURRENT_DATA`, écrit en dur : la constante
// n'existe pas dans tous les environnements.
const VIDEO_HAVE_CURRENT_DATA = 2;

// Caméra choisie par l'agent (ou retenue automatiquement), mémorisée
// pour la session : sur un téléphone donné, elle est reprise au scan
// suivant plutôt que d'être à rechoisir.
const CAMERA_KEY = "cava:presence-camera";

const readPreferredCamera = () => {
  try {
    return window.sessionStorage.getItem(CAMERA_KEY) || "";
  } catch {
    return "";
  }
};

const writePreferredCamera = (deviceId) => {
  try {
    if (deviceId) window.sessionStorage.setItem(CAMERA_KEY, deviceId);
    else window.sessionStorage.removeItem(CAMERA_KEY);
  } catch {
    /* stockage indisponible */
  }
};

// Flux déjà obtenu dans CE document. Une fois l'autorisation donnée à
// la connexion, l'écran de scan qui suit démarre seul, sans nouveau
// geste. Un rechargement remet à zéro : c'est alors la Permissions API
// qui dit si l'autorisation tient toujours.
let cameraObtainedInPage = false;

const readEnvironment = () => {
  const userAgent = navigator.userAgent ?? "";
  const mediaDevices = Boolean(navigator.mediaDevices);
  const getUserMedia = typeof navigator.mediaDevices?.getUserMedia === "function";
  const secureContext = Boolean(window.isSecureContext);

  let inIframe;

  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  return {
    userAgent,
    mediaDevices,
    getUserMedia,
    secureContext,
    inIframe,
    protocol: window.location.protocol,
    platform: detectPlatform(userAgent, navigator.maxTouchPoints ?? 0),
    browser: describeBrowser(userAgent),
    inAppBrowser: isInAppBrowser(userAgent, {
      secureContext,
      hasGetUserMedia: getUserMedia,
    }),
    policyAllowsCamera: readCameraPolicy(document),
  };
};

const stopStream = (stream) => stream?.getTracks().forEach((track) => track.stop());

// Attend que la vidéo ait réellement une image. Interrogé à intervalle
// court plutôt qu'à l'écoute d'événements : un `loadeddata` survenu
// avant l'abonnement serait perdu, et c'est précisément le genre de
// course qui diffère d'un navigateur à l'autre.
const waitForFirstFrame = (video, timeoutMs, isCurrent) =>
  new Promise((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      if (!isCurrent()) return resolve(false);

      if (video.readyState >= VIDEO_HAVE_CURRENT_DATA && video.videoWidth > 0) {
        return resolve(true);
      }

      if (Date.now() - startedAt >= timeoutMs) return resolve(false);

      window.setTimeout(check, 50);

      return undefined;
    };

    check();
  });

// Cycle de vie de la caméra :
//
//   off ──(autorisation déjà acquise)──────────▶ starting ──▶ ready
//    │                                               │
//    └──(sinon) bouton « Activer la caméra » ────────┘──▶ failed ──(Réessayer)──▶ starting
//
// - Le bouton « Activer la caméra » n'apparaît que lorsqu'une demande
//   d'autorisation VA s'afficher : la demande arrive alors au moment où
//   l'agent l'attend, au lieu d'une invite surgie au chargement qu'on
//   ferme par réflexe (et Chrome finit par ne plus la proposer). Caméra
//   déjà obtenue dans la page, autorisation accordée ou refusée : pas de
//   bouton, la caméra démarre (ou la cause de l'échec s'affiche) seule.
// - Un échec ne relance JAMAIS la caméra tout seul (pas de boucle de
//   demandes) — sauf si l'autorisation passe à « accordée » dans les
//   réglages : un changement, pas une répétition.
// - `active` à false met le décodage en pause ; la caméra reste ouverte
//   RELEASE_DELAY_MS, puis est libérée. Démontage, page masquée (écran
//   verrouillé, autre application) : libérée immédiatement.
const QrCameraScanner = ({ active, onDecode }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const rafRef = useRef(null);
  const releaseTimerRef = useRef(null);
  const slowTimerRef = useRef(null);

  // Chaque démarrage porte un numéro ; tout changement (démontage,
  // pause, reprise manuelle) périme le démarrage en cours. Un flux
  // arrivé pour un démarrage périmé est aussitôt relâché : deux flux ne
  // restent jamais ouverts en même temps.
  const runIdRef = useRef(0);

  // Numéro du démarrage en cours, `null` sinon : empêche qu'un rendu,
  // un double appui ou un effet rejoué lance un second `getUserMedia`
  // pendant que le premier attend encore la réponse de l'agent.
  const inFlightRef = useRef(null);

  const statusRef = useRef("off");
  const activeRef = useRef(active);
  const onDecodeRef = useRef(onDecode);
  const permissionRef = useRef("unknown");
  const failureKindRef = useRef(null);
  const resumeOnVisibleRef = useRef(false);
  const autoSwitchedRef = useRef(false);
  const decodePausedRef = useRef(false);
  const startCameraRef = useRef(null);
  const loggedActiveRef = useRef(null);

  const [status, setStatus] = useState("off");
  const [needsActivation, setNeedsActivation] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [failure, setFailure] = useState(null);
  const [slowStart, setSlowStart] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [decodePaused, setDecodePaused] = useState(false);

  // Toujours le `onDecode` du dernier rendu. Auparavant, la boucle de
  // décodage gardait celui du PREMIER rendu (fermeture figée dans un
  // useCallback sans dépendance).
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  const updateStatus = useCallback((next) => {
    statusRef.current = next;
    setStatus(next);
    setCameraFacts({ status: next });
  }, []);

  const releaseStream = useCallback(() => {
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const stream = streamRef.current;
    streamRef.current = null;

    if (stream) {
      stopStream(stream);
      logCamera("Camera", "cleanup", "pistes arrêtées");
    }

    const video = videoRef.current;

    if (video) video.srcObject = null;
  }, []);

  const invalidate = useCallback(() => {
    runIdRef.current += 1;
    inFlightRef.current = null;
    window.clearTimeout(slowTimerRef.current);
  }, []);

  const cancelRelease = useCallback(() => {
    window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = null;
  }, []);

  const refreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((device) => device.kind === "videoinput")
        .map(({ deviceId, label }) => ({ deviceId, label }));

      setCameras(videoInputs);
      setCameraFacts({
        cameras: videoInputs.map((device) => device.label || "(sans libellé)"),
      });

      return videoInputs;
    } catch (error) {
      logCamera("Camera", "enumerateDevices refusé", describeCameraError(error));

      return [];
    }
  }, []);

  const startLoops = useCallback(() => {
    const drawPreviewFrame = () => {
      const source = videoRef.current;
      const preview = previewCanvasRef.current;

      if (
        source &&
        preview &&
        source.readyState >= VIDEO_HAVE_CURRENT_DATA &&
        source.videoWidth &&
        source.videoHeight
      ) {
        // `getContext` peut rendre `null` (mémoire saturée sur un
        // Android d'entrée de gamme) : on saute l'image, sans planter.
        const context = preview.getContext("2d");

        if (context) {
          const { videoWidth, videoHeight } = source;
          const size = Math.min(videoWidth, videoHeight);
          const sx = (videoWidth - size) / 2;
          const sy = (videoHeight - size) / 2;

          context.drawImage(source, sx, sy, size, size, 0, 0, preview.width, preview.height);
        }
      }

      rafRef.current = window.requestAnimationFrame(drawPreviewFrame);
    };

    rafRef.current = window.requestAnimationFrame(drawPreviewFrame);

    // Un décodage à la fois : jsQR est SYNCHRONE, des passes empilées
    // bloqueraient le fil principal (aperçu et boutons figés).
    let decoding = false;
    let passes = 0;
    let lastValue = null;
    let absentPasses = 0;

    window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      const source = videoRef.current;
      const canvas = canvasRef.current;

      // `HAVE_CURRENT_DATA` et non `HAVE_ENOUGH_DATA` : sur un flux en
      // direct, beaucoup d'Android plafonnent à HAVE_CURRENT_DATA.
      if (
        decoding ||
        !activeRef.current ||
        decodePausedRef.current ||
        !source ||
        !canvas ||
        source.readyState < VIDEO_HAVE_CURRENT_DATA
      ) {
        return;
      }

      const { videoWidth, videoHeight } = source;

      if (!videoWidth || !videoHeight) return;

      decoding = true;

      try {
        // Carré central RÉDUIT : même cadrage que l'aperçu (ce que
        // l'agent voit entre les quatre coins est exactement ce qui est
        // analysé), ramené à DECODE_SIZE quelle que soit la définition.
        const size = Math.min(videoWidth, videoHeight);
        const sx = (videoWidth - size) / 2;
        const sy = (videoHeight - size) / 2;
        const target = Math.min(DECODE_SIZE, size);

        canvas.width = target;
        canvas.height = target;

        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) return;

        const startedAt = performance.now();

        context.drawImage(source, sx, sy, size, size, 0, 0, target, target);

        const imageData = context.getImageData(0, 0, target, target);

        // `attemptBoth` : fait aussi passer les QR clairs sur fond
        // sombre (QR de service affiché sur un téléphone en thème sombre).
        const result = jsQR(imageData.data, target, target, {
          inversionAttempts: "attemptBoth",
        });

        passes += 1;

        if (CAMERA_DIAGNOSTICS) {
          setCameraFacts({
            decodePasses: passes,
            lastDecodeMs: Math.round(performance.now() - startedAt),
            video: `${videoWidth}×${videoHeight} (readyState ${source.readyState})`,
          });
        }

        const value = result?.data;

        if (!value) {
          absentPasses += 1;

          return;
        }

        if (value === lastValue && absentPasses < REPEAT_AFTER_ABSENT_PASSES) {
          absentPasses = 0;

          return;
        }

        lastValue = value;
        absentPasses = 0;

        logCamera("Scanner", "QR décodé", value.slice(0, 48));
        setCameraFacts({ lastDecoded: value.slice(0, 48) });

        onDecodeRef.current?.(value);
      } finally {
        decoding = false;
      }
    }, SCAN_INTERVAL_MS);

    logCamera("Scanner", "initialized", { intervalMs: SCAN_INTERVAL_MS, decodeSize: DECODE_SIZE });
  }, []);

  const startCamera = useCallback(
    async ({ deviceId = null, force = false } = {}) => {
      if (inFlightRef.current !== null && !force) {
        logCamera("Camera", "démarrage ignoré : un démarrage est déjà en cours");

        return;
      }

      const runId = runIdRef.current + 1;

      runIdRef.current = runId;
      inFlightRef.current = runId;

      const isCurrent = () => runIdRef.current === runId;

      cancelRelease();
      releaseStream();
      failureKindRef.current = null;
      setFailure(null);
      setNeedsActivation(false);
      setSlowStart(false);
      updateStatus("starting");

      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = window.setTimeout(() => {
        if (isCurrent() && statusRef.current === "starting") setSlowStart(true);
      }, SLOW_START_MS);

      const env = readEnvironment();

      setCameraFacts({ ...env, error: null });

      const settle = () => {
        if (inFlightRef.current === runId) inFlightRef.current = null;

        window.clearTimeout(slowTimerRef.current);
        setSlowStart(false);
      };

      const fail = (kind, error) => {
        if (!isCurrent()) return;

        settle();
        releaseStream();
        failureKindRef.current = kind;
        setFailure({
          kind,
          message: cameraFailureMessage(kind, env),
          detail: formatCameraErrorDetail(error, kind),
        });
        updateStatus("failed");
        setCameraFacts({ error: describeCameraError(error) });
        logCamera("Camera", "échec", { kind, ...describeCameraError(error) });
      };

      const unavailableKind = () => {
        if (!env.secureContext) return "insecure";

        return env.inAppBrowser ? "in-app" : "unsupported";
      };

      logCamera("Camera", "initialize", { deviceId, force, ...env });

      // Cas A : l'API n'existe pas du tout (http://, adresse IP,
      // navigateur intégré). Aucune demande d'autorisation ne peut
      // s'afficher — ni être accordée.
      if (!env.mediaDevices) {
        logCamera("Camera", "navigator.mediaDevices absent (cas A)");
        fail(unavailableKind(), { name: "mediaDevices indisponible" });

        return;
      }

      logCamera("Camera", "mediaDevices available");

      // Cas B : l'objet existe, sans `getUserMedia`.
      if (!env.getUserMedia) {
        logCamera("Camera", "getUserMedia absent (cas B)");
        fail(unavailableKind(), { name: "getUserMedia indisponible" });

        return;
      }

      logCamera("Camera", "getUserMedia available");

      // Cas C : `getUserMedia` existe ; chaque rejet est journalisé avec
      // son name / message / constraint.
      const preferred = deviceId ?? readPreferredCamera();

      let stream = null;
      let lastError = null;

      for (const attempt of buildConstraintAttempts(preferred)) {
        logCamera("Camera", "requesting permission", attempt.label);

        try {
          stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
          logCamera("Camera", "permission result", `accordée — ${attempt.label}`);

          break;
        } catch (error) {
          lastError = error;
          logCamera("Camera", "permission result", {
            attempt: attempt.label,
            ...describeCameraError(error),
          });

          if (isPermissionError(error) || !isCurrent()) break;
        }
      }

      if (!stream) {
        fail(classifyCameraError(lastError, env), lastError);

        return;
      }

      if (!isCurrent()) {
        stopStream(stream);
        logCamera("Camera", "flux arrivé pour un démarrage périmé : relâché");

        return;
      }

      cameraObtainedInPage = true;
      streamRef.current = stream;

      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings?.() ?? {};

      logCamera("Camera", "stream received", {
        label: track?.label,
        width: settings.width,
        height: settings.height,
        facingMode: settings.facingMode,
      });
      setCameraFacts({
        selectedCamera: track?.label || "(sans libellé)",
        settings: `${settings.width ?? "?"}×${settings.height ?? "?"} ${settings.facingMode ?? ""}`.trim(),
      });

      // Caméra mémorisée qui n'existe plus (identifiants renouvelés) :
      // on l'oublie plutôt que de retenter chaque fois un `exact` voué
      // à l'échec.
      if (preferred && settings.deviceId && settings.deviceId !== preferred) {
        writePreferredCamera("");
      }

      // Piste coupée par le système (appel entrant, autre application
      // qui prend la caméra, autorisation retirée). `track.stop()` ne
      // déclenche pas cet événement : il ne signale que ce qui vient
      // d'ailleurs.
      track?.addEventListener?.("ended", () => {
        if (streamRef.current !== stream) return;

        logCamera("Camera", "piste terminée par le système");
        releaseStream();
        failureKindRef.current = "ended";
        setFailure({
          kind: "ended",
          message: cameraFailureMessage("ended", env),
          detail: "track ended",
        });
        updateStatus("failed");
      });

      // Mise au point continue, seulement si l'appareil la déclare :
      // sans elle, plusieurs Android restent sur une mise au point à
      // l'infini et la carte tenue à 15 cm reste floue. Au mieux, jamais
      // bloquant.
      try {
        if (track?.getCapabilities?.().focusMode?.includes("continuous")) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        }
      } catch {
        /* mise au point non pilotable : l'automatique de l'appareil fera. */
      }

      const video = videoRef.current;

      if (!video) {
        fail("unknown", { name: "élément vidéo absent" });

        return;
      }

      // Posés SUR L'ÉLÉMENT et pas seulement en JSX : React ne rend pas
      // l'attribut `muted` dans le DOM, et Chrome Android refuse de lire
      // automatiquement une vidéo qu'il ne voit pas muette.
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");

      video.srcObject = stream;
      logCamera("Camera", "video attached");

      // Un rejet de `play()` n'est pas fatal en soi (AbortError courant
      // sur Android, flux pourtant vivant) : ce qui compte, c'est
      // qu'une image arrive. On le vérifie juste après.
      try {
        await video.play();
        logCamera("Camera", "video playing");
      } catch (error) {
        logCamera("Camera", "video.play() rejeté (non bloquant)", describeCameraError(error));
      }

      let hasFrames = await waitForFirstFrame(video, FIRST_FRAME_TIMEOUT_MS, isCurrent);

      if (!isCurrent()) return;

      if (!hasFrames) {
        try {
          await video.play();
        } catch {
          /* dernière chance, le résultat se lit ci-dessous */
        }

        hasFrames = await waitForFirstFrame(video, FIRST_FRAME_TIMEOUT_MS / 2, isCurrent);

        if (!isCurrent()) return;
      }

      // Aucune image : on le dit, plutôt qu'un cadre noir sans fin.
      if (!hasFrames) {
        fail("playback", {
          name: "Aucune image reçue",
          message: `readyState ${video.readyState}`,
        });

        return;
      }

      settle();
      updateStatus("ready");
      startLoops();

      // Libellés disponibles maintenant que l'autorisation est accordée.
      const videoInputs = await refreshCameras();

      if (!isCurrent()) return;

      // Le navigateur a ouvert la caméra AVANT malgré la contrainte :
      // une seule bascule automatique vers l'arrière, jamais en boucle.
      if (!autoSwitchedRef.current) {
        const backId = findBackCameraSwitch(videoInputs, {
          facingMode: settings.facingMode,
          deviceId: settings.deviceId,
          label: track?.label,
        });

        if (backId) {
          autoSwitchedRef.current = true;
          logCamera("Camera", "caméra avant obtenue : bascule sur l'arrière", backId);
          writePreferredCamera(backId);
          startCameraRef.current?.({ deviceId: backId, force: true });
        }
      }
    },
    [cancelRelease, refreshCameras, releaseStream, startLoops, updateStatus]
  );

  useEffect(() => {
    startCameraRef.current = startCamera;
  }, [startCamera]);

  // Pause du scanner : décodage coupé tout de suite, caméra libérée
  // seulement si la pause dure (voir RELEASE_DELAY_MS).
  const scheduleRelease = useCallback(() => {
    if (inFlightRef.current !== null) {
      // Démarrage en cours : abandonné, son flux sera relâché à
      // l'arrivée.
      invalidate();
      releaseStream();
      releaseTimerRef.current = window.setTimeout(() => updateStatus("off"), 0);

      return;
    }

    if (!streamRef.current) return;

    cancelRelease();
    releaseTimerRef.current = window.setTimeout(() => {
      if (activeRef.current) return;

      logCamera("Camera", "pause prolongée : caméra libérée");
      invalidate();
      releaseStream();
      updateStatus("off");
    }, RELEASE_DELAY_MS);
  }, [cancelRelease, invalidate, releaseStream, updateStatus]);

  // Montage : environnement, autorisation (indicative) et nettoyage
  // complet au démontage — changement de route compris.
  useEffect(() => {
    let cancelled = false;
    let permissionStatus = null;

    const env = readEnvironment();

    setCameraFacts(env);
    logCamera("Camera", "environnement", env);

    const onPermissionChange = () => {
      const state = permissionStatus?.state ?? "unknown";

      permissionRef.current = state;
      setCameraFacts({ permission: state });
      logCamera("Camera", "autorisation modifiée", state);

      // L'agent vient d'autoriser la caméra dans les réglages : on
      // repart sans attendre qu'il pense à « Réessayer ».
      const waiting =
        statusRef.current === "off" ||
        (statusRef.current === "failed" && PERMISSION_KINDS.has(failureKindRef.current));

      if (state === "granted" && activeRef.current && waiting) {
        startCameraRef.current?.();
      }
    };

    queryCameraPermission(navigator).then((permission) => {
      if (cancelled) return;

      permissionStatus = permission;
      permissionRef.current = permission?.state ?? "unknown";
      setCameraFacts({ permission: permissionRef.current });
      logCamera("Camera", "autorisation (indicative)", permissionRef.current);
      permission?.addEventListener?.("change", onPermissionChange);
      setPermissionChecked(true);
    });

    const onDeviceChange = () => {
      if (streamRef.current) refreshCameras();
    };

    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener?.("change", onPermissionChange);
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      cancelRelease();
      invalidate();
      releaseStream();
      logCamera("Camera", "démontage : caméra libérée");
    };
  }, [cancelRelease, invalidate, refreshCameras, releaseStream]);

  // Écran verrouillé, application en arrière-plan : la caméra est
  // libérée tout de suite (Android la coupe de toute façon, mais sans
  // prévenir proprement) et rouverte au retour si le scanner l'utilisait.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!streamRef.current && inFlightRef.current === null) return;

        resumeOnVisibleRef.current = true;
        logCamera("Camera", "page masquée : caméra libérée");
        cancelRelease();
        invalidate();
        releaseStream();
        updateStatus("off");

        return;
      }

      if (!resumeOnVisibleRef.current) return;

      resumeOnVisibleRef.current = false;

      if (activeRef.current && statusRef.current !== "failed") {
        logCamera("Camera", "page de nouveau visible : redémarrage");
        startCameraRef.current?.();
      }
    };

    const onPageHide = () => {
      cancelRelease();
      invalidate();
      releaseStream();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [cancelRelease, invalidate, releaseStream, updateStatus]);

  useEffect(() => {
    activeRef.current = active;

    // L'effet se rejoue aussi quand l'autorisation a été lue : on ne
    // journalise que les vrais changements.
    if (loggedActiveRef.current !== active) {
      loggedActiveRef.current = active;
      logCamera("Scanner", active ? "started" : "stopped");
    }

    if (!active) {
      scheduleRelease();

      return undefined;
    }

    cancelRelease();

    if (
      !permissionChecked ||
      streamRef.current ||
      inFlightRef.current !== null ||
      statusRef.current === "failed"
    ) {
      return undefined;
    }

    // Planifié plutôt qu'appelé directement : le démarrage met à jour
    // l'état, ce qui n'a pas sa place dans le corps d'un effet.
    const timer = window.setTimeout(() => {
      if (!activeRef.current || streamRef.current || inFlightRef.current !== null) return;

      // « Activer la caméra » n'a de sens que si une demande
      // d'autorisation va s'afficher (état `prompt` ou inconnu). Refusée
      // — par l'agent, le système ou la Permissions-Policy du site — ou
      // API absente : aucune demande ne peut apparaître. On tente alors
      // tout de suite, UNE fois, pour afficher la cause exacte et sa
      // consigne, plutôt qu'un bouton qui ne mènerait qu'à ce message.
      const canAutoStart =
        cameraObtainedInPage ||
        permissionRef.current === "granted" ||
        permissionRef.current === "denied" ||
        typeof navigator.mediaDevices?.getUserMedia !== "function";

      if (canAutoStart) {
        startCamera();
      } else {
        logCamera("Camera", "attente du geste de l'agent (Activer la caméra)");
        setNeedsActivation(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [active, permissionChecked, cancelRelease, scheduleRelease, startCamera]);

  const switchCamera = () => {
    const current = streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId;
    const next = nextCameraId(cameras, current);

    if (!next) return;

    logCamera("Camera", "changement de caméra demandé", next);
    writePreferredCamera(next);
    startCamera({ deviceId: next, force: true });
  };

  const toggleDecoding = () => {
    const next = !decodePausedRef.current;

    decodePausedRef.current = next;
    setDecodePaused(next);
    logCamera("Scanner", next ? "décodage en pause (test A : caméra seule)" : "décodage repris (test B)");
  };

  const live = status === "ready";
  const showActivate = active && needsActivation && status === "off";
  const showStarting = status === "starting";

  return (
    <div
      className="qr-camera-scanner"
      data-status={status}
    >
      <div className="qr-camera-scanner__frame">
        {/* Toujours dans le DOM : la référence existe avant le premier
            flux, et un changement d'état ne démonte jamais la vidéo
            pendant qu'un flux s'y attache. Jamais affichée (le carré
            est dessiné sur le canvas) mais dimensionnée normalement :
            `display: none` suspend le décodage sur certains navigateurs. */}
        <video
          ref={videoRef}
          className="qr-camera-scanner__source-video"
          playsInline
          muted
          autoPlay
          aria-hidden="true"
        />
        <canvas
          ref={previewCanvasRef}
          className="qr-camera-scanner__video"
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          hidden={!live}
          aria-label="Aperçu de la caméra pour la lecture du QR code"
        />

        {!live && !showActivate && !showStarting &&
          (status === "failed" ? (
            <CameraOff
              className="qr-camera-scanner__placeholder"
              aria-hidden="true"
            />
          ) : (
            <Camera
              className="qr-camera-scanner__placeholder"
              aria-hidden="true"
            />
          ))}

        {showActivate && (
          <div className="qr-camera-scanner__overlay">
            <button
              type="button"
              className="qr-camera-scanner__activate"
              onClick={() => startCamera()}
            >
              <Camera
                size={20}
                aria-hidden="true"
              />
              Activer la caméra
            </button>
          </div>
        )}

        {showStarting && (
          <div
            className="qr-camera-scanner__overlay"
            role="status"
          >
            <Loader2
              className="qr-camera-scanner__spinner"
              aria-hidden="true"
            />
            <span>Activation de la caméra…</span>

            {slowStart && (
              <>
                <small>Aucune demande d&apos;autorisation ne s&apos;affiche ?</small>
                <button
                  type="button"
                  className="qr-camera-scanner__retry-inline"
                  onClick={() => startCamera({ force: true })}
                >
                  <RefreshCw
                    size={14}
                    aria-hidden="true"
                  />
                  Réessayer
                </button>
              </>
            )}
          </div>
        )}

        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--tl"
          aria-hidden="true"
        />
        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--tr"
          aria-hidden="true"
        />
        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--bl"
          aria-hidden="true"
        />
        <span
          className="qr-camera-scanner__corner qr-camera-scanner__corner--br"
          aria-hidden="true"
        />

        {active && live && (
          <span
            className="qr-camera-scanner__line"
            aria-hidden="true"
          />
        )}

        {live && cameras.length > 1 && (
          <button
            type="button"
            className="qr-camera-scanner__switch"
            onClick={switchCamera}
          >
            <SwitchCamera
              size={16}
              aria-hidden="true"
            />
            Changer de caméra
          </button>
        )}
      </div>

      {status === "failed" && failure && (
        <div className="qr-camera-scanner__recover">
          <p role="alert">{failure.message}</p>

          <small className="qr-camera-scanner__detail">
            Détail technique : {failure.detail}
          </small>

          <button
            type="button"
            onClick={() => startCamera({ force: true })}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />
            Réessayer
          </button>
        </div>
      )}

      {CAMERA_DIAGNOSTICS && (
        <CameraDiagnostics
          decodingPaused={decodePaused}
          onToggleDecoding={toggleDecoding}
        />
      )}

      <canvas
        ref={canvasRef}
        className="qr-camera-scanner__canvas"
        aria-hidden="true"
      />
    </div>
  );
};

export default QrCameraScanner;
