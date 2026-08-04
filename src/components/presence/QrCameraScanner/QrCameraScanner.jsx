import { useEffect, useRef, useState } from "react";

import jsQR from "jsqr";

import { Camera } from "lucide-react";

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
const QrCameraScanner = ({ active, onDecode, onError, hint }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setReady(true);

        intervalRef.current = window.setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            return;
          }

          const width = video.videoWidth;
          const height = video.videoHeight;

          if (!width || !height) return;

          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(video, 0, 0, width, height);

          const imageData = context.getImageData(0, 0, width, height);
          const result = jsQR(imageData.data, width, height, {
            inversionAttempts: "dontInvert",
          });

          if (result?.data) {
            onDecode(result.data);
          }
        }, SCAN_INTERVAL_MS);
      } catch {
        if (!cancelled) {
          onError?.(
            "Impossible d'accéder à la caméra. Vérifiez l'autorisation dans votre navigateur."
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="qr-camera-scanner">
      <div className="qr-camera-scanner__frame">
        {active ? (
          <video
            ref={videoRef}
            className="qr-camera-scanner__video"
            playsInline
            muted
            aria-label="Aperçu de la caméra pour la lecture du QR code"
          />
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

        {active && ready && (
          <span
            className="qr-camera-scanner__line"
            aria-hidden="true"
          />
        )}
      </div>

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
