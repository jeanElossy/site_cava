import { useCallback, useEffect, useRef, useState } from "react";

import jsQR from "jsqr";

import { Camera, RefreshCw, SwitchCamera } from "lucide-react";

import "./QrCameraScanner.scss";

// Fréquence de décodage : 5 images/s suffit largement à un scan perçu
// comme instantané, pour un coût CPU bien inférieur à une décodification
// à chaque frame vidéo (jusqu'à 60/s).
const SCAN_INTERVAL_MS = 200;

// Lecteur de QR code par caméra, réutilisé à deux endroits du badgeage
// des présences : la connexion agent (QR de sécurité, une seule lecture)
// et le scanner continu de cartes membres (voir docs/superpowers/specs/
// 2026-08-04-badgeage-presences-design.md). Aucune dépendance serveur :
// tout le décodage a lieu dans le navigateur (`jsqr`).
// Résolution de dessin de l'aperçu visible : carrée, indépendante de
// la taille d'affichage réelle (mise à l'échelle par le CSS comme une
// image) — assez nette pour un aperçu, sans coût de calcul inutile.
const PREVIEW_SIZE = 480;

// Côté du carré RÉELLEMENT décodé, indépendant de la définition du
// flux. C'est le correctif de fond pour Android : jsQR travaille en
// JavaScript sur le fil principal, son coût est proportionnel au
// nombre de pixels. Beaucoup d'Android livrent du 1080p, voire plus,
// là où un iPhone reste sur un format modeste — 2 millions de pixels
// à analyser cinq fois par seconde saturent le fil principal, le
// décodage prend alors plus longtemps que l'intervalle qui le
// déclenche et le scan « ne marche pas », caméra pourtant allumée.
// 512 px suffisent très largement à lire un QR qui occupe le cadre.
const DECODE_SIZE = 512;

// Repère de la caméra choisie à la main par l'agent. Mémorisé pour la
// session (appareil partagé, voir services/presences.js) : une fois la
// bonne caméra trouvée sur un téléphone donné, elle est reprise au
// scan suivant plutôt que d'être à rechoisir à chaque fois.
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

// Une caméra ARRIÈRE, reconnue à son libellé. `facingMode` ne suffit
// pas sur Android : beaucoup de téléphones exposent trois ou quatre
// objectifs arrière (grand-angle, macro, téléobjectif) et le
// navigateur en choisit un qui ne fait pas la mise au point à 15 cm —
// la carte reste floue et n'est jamais décodée, alors que l'aperçu
// s'affiche normalement. C'est le symptôme décrit : « la caméra
// s'allume mais ne scanne pas », côté Android seulement.
const isBackCameraLabel = (label = "") =>
  /back|rear|arrière|arriere|environment/i.test(label);

// Un navigateur intégré à une autre application (le lien ouvert depuis
// WhatsApp, Facebook, Messenger…) n'a très souvent AUCUN accès à la
// caméra, quelles que soient les autorisations accordées : le refus ne
// vient pas du site mais de l'application hôte. Cas fréquent ici, le QR
// de service circulant par WhatsApp — et parfaitement invisible pour
// l'agent, qui voit un navigateur ordinaire.
const isInAppBrowser = () => {
  const ua = navigator.userAgent ?? "";

  // « wv » marque une WebView Android ; les autres sont les navigateurs
  // intégrés qui s'annoncent explicitement.
  return /\bwv\b|FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger/i.test(ua);
};

// Message d'échec adapté à la CAUSE, et surtout à ce que l'agent doit
// FAIRE. « Vérifiez l'autorisation » était affiché quoi qu'il arrive, y
// compris quand l'autorisation était accordée et que l'échec venait
// d'ailleurs.
const failureMessage = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      // Un refus mémorisé ne redemande JAMAIS : réessayer sans rien
      // changer redonnera la même erreur, indéfiniment. D'où des
      // consignes concrètes plutôt qu'un « autorisez la caméra » que
      // l'agent croit déjà avoir fait.
      if (isInAppBrowser()) {
        return "Cette page est ouverte dans le navigateur interne d'une autre application (WhatsApp, Facebook…), qui bloque la caméra. Touchez le menu ⋮ puis « Ouvrir dans Chrome », et reconnectez-vous.";
      }

      return "L'accès à la caméra est bloqué pour ce site. Touchez l'icône à gauche de l'adresse du site, en haut de l'écran, puis Autorisations → Caméra → Autoriser. Vérifiez aussi que la caméra est autorisée pour votre navigateur dans les réglages du téléphone.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Aucune caméra utilisable n'a été trouvée sur cet appareil.";
    case "NotReadableError":
      return "La caméra est déjà utilisée par une autre application. Fermez-la complètement, puis réessayez.";
    default:
      return "La caméra n'a pas pu démarrer. Touchez « Activer la caméra » pour réessayer.";
  }
};

// Un refus d'autorisation ne se rejoue pas avec d'autres contraintes :
// insister ne ferait que redemander, et parfois réafficher une invite
// que l'utilisateur vient de refuser.
const isPermissionError = (error) =>
  error?.name === "NotAllowedError" || error?.name === "SecurityError";

// Les échecs de caméra ne remontent PAS au parent : ce composant les
// affiche lui-même, avec la consigne adaptée et le bouton de reprise.
// Les faire remonter en plus affichait deux fois le même message à
// l'écran, celui du parent étant le plus court et le moins utile.
const QrCameraScanner = ({ active, onDecode, hint }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const rafRef = useRef(null);

  // Chaque démarrage porte un numéro. Une reprise manuelle, ou un
  // changement de `active` pendant l'attente de l'autorisation, périme
  // le démarrage en cours : sans ce jeton, deux flux pouvaient rester
  // ouverts en même temps, la caméra du second n'étant jamais affichée.
  const runIdRef = useRef(0);

  const [status, setStatus] = useState("idle");
  const [failure, setFailure] = useState("");
  const [cameras, setCameras] = useState([]);

  // Caméra imposée par l'agent via « Changer de caméra ». `null` =
  // choix automatique. Dans une ref plutôt qu'un état : `startCamera`
  // la lit, et la faire entrer dans ses dépendances relancerait la
  // caméra en boucle.
  const preferredCameraRef = useRef(readPreferredCamera());

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    stopCamera();
    setStatus("starting");
    setFailure("");

    const fail = (error) => {
      if (runId !== runIdRef.current) return;

      setStatus("failed");
      setFailure(failureMessage(error));
    };

    // `getUserMedia` n'existe tout simplement PAS hors contexte
    // sécurisé. Sur un téléphone ouvert en http:// ou par adresse IP,
    // l'appel échouait donc sur un « undefined is not a function »
    // avalé par le catch, et l'agent voyait un message d'autorisation
    // alors qu'aucune invite n'avait jamais pu s'afficher.
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = window.isSecureContext
        ? "Ce navigateur ne permet pas l'accès à la caméra."
        : "La caméra exige une connexion sécurisée (https). Ouvrez le site en https, pas par son adresse IP.";

      setStatus("failed");
      setFailure(message);

      return;
    }

    // Trois tentatives, de la plus précise à la plus permissive. Une
    // seule contrainte est en `exact` — la caméra explicitement
    // choisie par l'agent : si celle-là n'est pas disponible, il faut
    // le savoir et retomber sur l'automatique, pas obtenir en silence
    // une autre caméra que celle demandée.
    //
    // Le reste est en `ideal` : une contrainte `exact` sur
    // `facingMode` fait échouer l'ouverture sur les appareils qui
    // n'étiquettent pas leurs objectifs, alors qu'ils ont bien une
    // caméra arrière utilisable.
    //
    // Définition demandée en 1280×720 et non plus 720×720 : un QR
    // occupe une petite part du cadre, et c'est le nombre de pixels
    // QU'IL couvre qui décide si jsQR le lit. Le coût de calcul, lui,
    // ne suit plus la définition du flux depuis que le décodage
    // travaille sur un carré réduit (voir DECODE_SIZE).
    const attempts = [];

    if (preferredCameraRef.current) {
      attempts.push({
        video: {
          deviceId: { exact: preferredCameraRef.current },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    }

    attempts.push({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    attempts.push({ video: true, audio: false });

    let stream;
    let lastError;

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;

        // Un refus d'autorisation ne se rejoue pas : insister ne ferait
        // que redemander, parfois en réaffichant une invite que
        // l'utilisateur vient de refuser.
        if (isPermissionError(error)) break;
      }
    }

    if (!stream) {
      fail(lastError);

      return;
    }

    if (runId !== runIdRef.current) {
      stream.getTracks().forEach((track) => track.stop());

      return;
    }

    streamRef.current = stream;

    // Mise au point continue, demandée au mieux. Sans elle, plusieurs
    // Android restent bloqués sur une mise au point à l'infini : la
    // carte tenue à 15 cm reste floue et jsQR ne trouve jamais les
    // repères du QR. Non standard partout, d'où le `catch` — un
    // navigateur qui ne connaît pas la contrainte doit continuer sans,
    // pas échouer.
    const [videoTrack] = stream.getVideoTracks();

    try {
      await videoTrack?.applyConstraints({
        advanced: [{ focusMode: "continuous" }],
      });
    } catch {
      /* mise au point non pilotable : l'automatique de l'appareil fera. */
    }

    // Liste des caméras, pour le bouton « Changer de caméra ». Peuplée
    // seulement MAINTENANT : avant l'autorisation, les libellés sont
    // vides sur tous les navigateurs, et une liste d'entrées anonymes
    // ne permettrait à personne de choisir.
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (runId !== runIdRef.current) return;

        const videoInputs = devices.filter((device) => device.kind === "videoinput");

        setCameras(videoInputs);

        // Aucune caméra choisie à la main, et celle qu'on a obtenue
        // n'est pas une arrière : on retient la première arrière
        // repérée au libellé pour le prochain démarrage plutôt que de
        // relancer le flux dans le dos de l'agent.
        if (!preferredCameraRef.current) {
          const current = videoTrack?.getSettings?.().deviceId;
          const currentDevice = videoInputs.find((device) => device.deviceId === current);
          const back = videoInputs.find((device) => isBackCameraLabel(device.label));

          if (back && currentDevice && !isBackCameraLabel(currentDevice.label)) {
            preferredCameraRef.current = back.deviceId;
            writePreferredCamera(back.deviceId);
          }
        }
      })
      .catch(() => {
        /* énumération refusée : le bouton de changement reste masqué. */
      });

    const video = videoRef.current;

    if (!video) {
      stopCamera();
      fail(new Error("video element absent"));

      return;
    }

    // Posés SUR L'ÉLÉMENT et pas seulement en JSX : React ne rend pas
    // l'attribut `muted` dans le DOM, et Chrome Android refuse de lire
    // automatiquement une vidéo qu'il ne voit pas muette. C'est l'une
    // des raisons pour lesquelles le scanner démarrait sur iPhone et
    // pas sur Android, autorisations pourtant accordées.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");

    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      // NON FATAL, et c'est tout le correctif : `play()` rejette
      // couramment sur Android (AbortError quand une lecture précédente
      // est interrompue) alors que le flux est bien vivant. Cette
      // exception faisait basculer TOUT le démarrage dans le catch
      // général : ni aperçu, ni décodage, et un message d'autorisation
      // trompeur — alors qu'il n'y avait qu'à continuer.
    }

    if (runId !== runIdRef.current) return;

    const drawPreviewFrame = () => {
      const source = videoRef.current;
      const preview = previewCanvasRef.current;

      if (source && preview && source.readyState >= source.HAVE_CURRENT_DATA) {
        const { videoWidth, videoHeight } = source;

        if (videoWidth && videoHeight) {
          const size = Math.min(videoWidth, videoHeight);
          const sx = (videoWidth - size) / 2;
          const sy = (videoHeight - size) / 2;

          preview
            .getContext("2d")
            .drawImage(
              source,
              sx,
              sy,
              size,
              size,
              0,
              0,
              preview.width,
              preview.height
            );
        }
      }

      rafRef.current = window.requestAnimationFrame(drawPreviewFrame);
    };

    rafRef.current = window.requestAnimationFrame(drawPreviewFrame);

    // Un décodage à la fois. jsQR est SYNCHRONE : si une passe dure
    // plus longtemps que l'intervalle — ce qui arrivait précisément sur
    // les Android en pleine définition —, les suivantes s'empilent et
    // le fil principal ne rend plus la main, ni à l'aperçu, ni aux
    // boutons. Le drapeau borne le travail à ce que l'appareil sait
    // vraiment tenir.
    let decoding = false;

    intervalRef.current = window.setInterval(() => {
      const source = videoRef.current;
      const canvas = canvasRef.current;

      // `HAVE_CURRENT_DATA` et non plus `HAVE_ENOUGH_DATA` : sur un flux
      // caméra en direct, beaucoup d'Android plafonnent à
      // HAVE_CURRENT_DATA et n'atteignent JAMAIS HAVE_ENOUGH_DATA, qui
      // décrit un tampon suffisant pour lire sans interruption — notion
      // sans objet pour du direct. L'égalité stricte empêchait donc tout
      // décodage sur ces appareils, aperçu affiché ou non.
      if (
        decoding ||
        !source ||
        !canvas ||
        source.readyState < source.HAVE_CURRENT_DATA
      ) {
        return;
      }

      const videoWidth = source.videoWidth;
      const videoHeight = source.videoHeight;

      if (!videoWidth || !videoHeight) return;

      decoding = true;

      try {
        // Carré central RÉDUIT : même cadrage que l'aperçu (donc ce que
        // l'agent voit entre les quatre coins est exactement ce qui est
        // analysé), ramené à DECODE_SIZE quelle que soit la définition
        // livrée par l'appareil. C'est ce qui met un Android 1080p au
        // même coût de calcul qu'un iPhone.
        const size = Math.min(videoWidth, videoHeight);
        const sx = (videoWidth - size) / 2;
        const sy = (videoHeight - size) / 2;
        const target = Math.min(DECODE_SIZE, size);

        canvas.width = target;
        canvas.height = target;

        const context = canvas.getContext("2d", { willReadFrequently: true });

        context.drawImage(source, sx, sy, size, size, 0, 0, target, target);

        const imageData = context.getImageData(0, 0, target, target);

        // `attemptBoth` : le coût d'une seconde passe inversée est
        // devenu négligeable sur une image réduite, et il fait passer
        // les QR rendus en clair sur fond sombre — le badge invité est
        // imprimé vert foncé sur blanc, mais un écran de téléphone en
        // thème sombre présentant le QR de service, lui, est inversé.
        const result = jsQR(imageData.data, target, target, {
          inversionAttempts: "attemptBoth",
        });

        if (result?.data) {
          onDecode(result.data);
        }
      } finally {
        decoding = false;
      }
    }, SCAN_INTERVAL_MS);

    setStatus("ready");
    // `onDecode` change à chaque rendu du parent : l'inclure
    // relancerait la caméra en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  // Bascule vers la caméra suivante. Dernier recours mais recours
  // réel : sur un Android à plusieurs objectifs arrière, aucune
  // heuristique ne dit lequel fait la mise au point de près — l'agent,
  // lui, le voit tout de suite dans l'aperçu. Le choix est retenu pour
  // la session, donc à faire une seule fois par appareil.
  const switchCamera = useCallback(() => {
    if (cameras.length < 2) return;

    const currentIndex = cameras.findIndex(
      (device) => device.deviceId === preferredCameraRef.current
    );
    const next = cameras[(currentIndex + 1) % cameras.length];

    preferredCameraRef.current = next.deviceId;
    writePreferredCamera(next.deviceId);

    startCamera();
  }, [cameras, startCamera]);

  useEffect(() => {
    if (!active) {
      // Pas de `setStatus` ici : l'état n'est lu que sous `active`
      // (ligne de scan et bloc de reprise), le remettre à zéro
      // déclencherait un rendu en cascade pour rien.
      runIdRef.current += 1;
      stopCamera();

      return undefined;
    }

    // Planifié plutôt qu'appelé directement, pour deux raisons : le
    // démarrage met à jour l'état, ce qui n'a pas sa place dans le corps
    // d'un effet (rendu en cascade) ; et cela laisse au navigateur le
    // temps d'attacher la balise <video> avant qu'on lui pose un flux.
    const timer = window.setTimeout(startCamera, 0);

    return () => {
      window.clearTimeout(timer);
      runIdRef.current += 1;
      stopCamera();
    };
  }, [active, startCamera, stopCamera]);

  return (
    <div className="qr-camera-scanner">
      <div className="qr-camera-scanner__frame">
        {active ? (
          <>
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
              aria-label="Aperçu de la caméra pour la lecture du QR code"
            />
          </>
        ) : (
          <Camera
            className="qr-camera-scanner__placeholder"
            aria-hidden="true"
          />
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

        {active && status === "ready" && (
          <span
            className="qr-camera-scanner__line"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Reprise MANUELLE. Un démarrage automatique dépend de règles de
          lecture automatique et d'autorisation que le navigateur peut
          refuser sans rien dire ; un appui de l'agent, lui, est un geste
          utilisateur explicite, que tous les navigateurs acceptent. */}
      {active && status === "failed" && (
        <div className="qr-camera-scanner__recover">
          <p role="alert">{failure}</p>

          <button type="button" onClick={startCamera}>
            <RefreshCw size={16} aria-hidden="true" />
            Activer la caméra
          </button>
        </div>
      )}

      {/* Proposé dès que l'appareil expose plusieurs caméras, sans
          attendre un échec : rien ne « rate » visiblement quand c'est
          le mauvais objectif qui est ouvert — l'aperçu s'affiche, la
          carte reste simplement floue et le scan n'aboutit jamais.
          L'agent doit pouvoir corriger ça sans deviner qu'il y a
          quelque chose à corriger. */}
      {active && cameras.length > 1 && (
        <button
          type="button"
          className="qr-camera-scanner__switch"
          onClick={switchCamera}
        >
          <SwitchCamera size={16} aria-hidden="true" />
          Changer de caméra
        </button>
      )}

      {hint && <p className="qr-camera-scanner__hint">{hint}</p>}

      <canvas
        ref={canvasRef}
        className="qr-camera-scanner__canvas"
        aria-hidden="true"
      />
    </div>
  );
};

export default QrCameraScanner;
