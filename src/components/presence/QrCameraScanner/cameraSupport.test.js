import { describe, it, expect } from "vitest";

import {
  buildConstraintAttempts,
  cameraFailureMessage,
  classifyCameraError,
  describeBrowser,
  detectPlatform,
  findBackCameraSwitch,
  formatCameraErrorDetail,
  isInAppBrowser,
  nextCameraId,
  queryCameraPermission,
  readCameraPolicy,
} from "./cameraSupport";

const UA = {
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  redmiMiui:
    "Mozilla/5.0 (Linux; U; Android 12; fr-fr; Redmi Note 11 Build/SKQ1) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.5.10",
  webView:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36",
  whatsapp:
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 WhatsApp/2.24",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.7258.76 Mobile/15E148 Safari/604.1",
  ipadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
};

describe("buildConstraintAttempts", () => {
  it("ne demande jamais la caméra arrière en `exact` (échec sur les objectifs non étiquetés)", () => {
    const attempts = buildConstraintAttempts("device-1");

    for (const { constraints } of attempts) {
      const facingMode = constraints.video?.facingMode;

      if (facingMode) expect(facingMode).toEqual({ ideal: "environment" });
    }
  });

  it("essaie d'abord la caméra choisie, en exact, puis l'arrière, puis n'importe laquelle", () => {
    const attempts = buildConstraintAttempts("device-1");

    expect(attempts).toHaveLength(3);
    expect(attempts[0].constraints.video.deviceId).toEqual({ exact: "device-1" });
    expect(attempts[1].constraints.video.facingMode).toEqual({ ideal: "environment" });
    expect(attempts[2].constraints).toEqual({ video: true, audio: false });
  });

  it("sans caméra choisie : arrière puis n'importe laquelle", () => {
    const attempts = buildConstraintAttempts("");

    expect(attempts).toHaveLength(2);
    expect(attempts[0].constraints.video.deviceId).toBeUndefined();
  });

  it("ne demande jamais le micro", () => {
    for (const { constraints } of buildConstraintAttempts("x")) {
      expect(constraints.audio).toBe(false);
    }
  });
});

describe("classifyCameraError", () => {
  const error = (name, message = "") => ({ name, message });

  it.each([
    [error("NotAllowedError", "Permission denied"), {}, "denied"],
    [error("PermissionDeniedError"), {}, "denied"],
    [error("SecurityError"), {}, "denied"],
    [error("NotAllowedError", "Permission dismissed"), {}, "dismissed"],
    [error("NotAllowedError", "Permission denied by system"), {}, "denied-system"],
    [error("NotAllowedError", "Permission denied"), { inAppBrowser: true }, "in-app"],
    [error("NotFoundError"), {}, "not-found"],
    [error("DevicesNotFoundError"), {}, "not-found"],
    [error("NotReadableError", "Could not start video source"), {}, "busy"],
    [error("TrackStartError"), {}, "busy"],
    [error("OverconstrainedError"), {}, "overconstrained"],
    [error("ConstraintNotSatisfiedError"), {}, "overconstrained"],
    [error("AbortError"), {}, "aborted"],
    [error("TypeError"), { secureContext: false }, "insecure"],
    [error("TypeError"), {}, "unknown"],
    [error("QuelqueChoseError"), {}, "unknown"],
    [undefined, {}, "unknown"],
  ])("%o avec %o → %s", (err, context, expected) => {
    expect(classifyCameraError(err, context)).toBe(expected);
  });

  // La panne Android : Chrome rejette en NotAllowedError « Permission
  // denied », exactement comme un refus de l'agent. Seule la politique
  // du document permet de les distinguer.
  it("un refus venu de la Permissions-Policy du site prime sur tout le reste", () => {
    expect(
      classifyCameraError(error("NotAllowedError", "Permission denied"), {
        policyAllowsCamera: false,
        inAppBrowser: true,
      })
    ).toBe("policy");
  });
});

describe("cameraFailureMessage", () => {
  it("donne des consignes propres à Android et à iOS pour un refus", () => {
    const android = cameraFailureMessage("denied", { platform: "android" });
    const ios = cameraFailureMessage("denied", { platform: "ios" });

    expect(android).toMatch(/Autorisations → Caméra/);
    expect(ios).toMatch(/Réglages du site web/);
    expect(android).not.toBe(ios);
  });

  it("n'envoie pas l'agent dans ses réglages quand c'est le site qui bloque", () => {
    const message = cameraFailureMessage("policy", { platform: "android" });

    expect(message).toMatch(/configuration du site/);
    expect(message).not.toMatch(/Autorisations/);
  });

  it("a un message pour chaque cause", () => {
    const kinds = [
      "policy", "in-app", "dismissed", "denied-system", "denied", "insecure",
      "unsupported", "not-found", "overconstrained", "busy", "aborted",
      "ended", "playback", "unknown",
    ];

    for (const kind of kinds) {
      expect(cameraFailureMessage(kind, { platform: "android" }).length).toBeGreaterThan(20);
    }

    expect(cameraFailureMessage("busy")).toMatch(/déjà utilisée par une autre application/);
    expect(cameraFailureMessage("not-found")).toBe("Aucune caméra disponible sur cet appareil.");
    expect(cameraFailureMessage("unsupported")).toMatch(/Google Chrome/);
  });
});

describe("formatCameraErrorDetail", () => {
  it("reprend name, message et contrainte fautive", () => {
    expect(
      formatCameraErrorDetail(
        { name: "OverconstrainedError", message: "", constraint: "deviceId" },
        "overconstrained"
      )
    ).toBe("OverconstrainedError · contrainte : deviceId");
  });

  it("signale la Permissions-Policy quand c'est elle qui bloque", () => {
    expect(
      formatCameraErrorDetail({ name: "NotAllowedError", message: "Permission denied" }, "policy")
    ).toBe("NotAllowedError · Permission denied · Permissions-Policy");
  });
});

describe("findBackCameraSwitch", () => {
  const android = [
    { deviceId: "front", label: "camera2 1, facing front" },
    { deviceId: "back-0", label: "camera2 0, facing back" },
    { deviceId: "back-2", label: "camera2 2, facing back" },
  ];

  it("bascule sur la caméra arrière principale quand l'avant a été ouverte", () => {
    expect(findBackCameraSwitch(android, { facingMode: "user", deviceId: "front" })).toBe("back-0");
    expect(findBackCameraSwitch(android, { label: "camera2 1, facing front", deviceId: "front" })).toBe("back-0");
  });

  it("ne change rien quand une caméra arrière est déjà ouverte", () => {
    expect(findBackCameraSwitch(android, { facingMode: "environment", deviceId: "back-0" })).toBeNull();
  });

  it("ne touche pas une caméra qu'on ne sait pas situer (webcam d'ordinateur)", () => {
    const laptop = [{ deviceId: "cam", label: "Integrated Camera (04f2:b6dd)" }];

    expect(findBackCameraSwitch(laptop, { label: "Integrated Camera (04f2:b6dd)", deviceId: "cam" })).toBeNull();
  });

  it("évite ultra grand-angle et téléobjectif (mise au point de près)", () => {
    const iphone = [
      { deviceId: "front", label: "Caméra avant" },
      { deviceId: "ultra", label: "Back Ultra Wide Camera" },
      { deviceId: "main", label: "Back Camera" },
    ];

    expect(findBackCameraSwitch(iphone, { facingMode: "user", deviceId: "front" })).toBe("main");
  });

  it("rien à faire sans caméra arrière", () => {
    expect(findBackCameraSwitch([android[0]], { facingMode: "user", deviceId: "front" })).toBeNull();
  });
});

describe("nextCameraId", () => {
  const cams = [{ deviceId: "a" }, { deviceId: "b" }, { deviceId: "c" }];

  it("passe à la suivante, en boucle", () => {
    expect(nextCameraId(cams, "a")).toBe("b");
    expect(nextCameraId(cams, "c")).toBe("a");
    expect(nextCameraId(cams, "inconnue")).toBe("a");
  });

  it("aucune bascule possible avec une seule caméra", () => {
    expect(nextCameraId([{ deviceId: "a" }], "a")).toBeNull();
    expect(nextCameraId([], undefined)).toBeNull();
  });
});

describe("environnement", () => {
  it("reconnaît la plateforme, iPad « bureau » compris", () => {
    expect(detectPlatform(UA.chromeAndroid)).toBe("android");
    expect(detectPlatform(UA.safariIos)).toBe("ios");
    expect(detectPlatform(UA.chromeIos)).toBe("ios");
    expect(detectPlatform(UA.ipadDesktop, 5)).toBe("ios");
    expect(detectPlatform(UA.ipadDesktop, 0)).toBe("other");
  });

  it("nomme le navigateur malgré les UA qui se déclarent tous « Chrome » ou « Safari »", () => {
    expect(describeBrowser(UA.chromeAndroid)).toBe("Chrome 139");
    expect(describeBrowser(UA.samsung)).toBe("Samsung Internet 27");
    expect(describeBrowser(UA.redmiMiui)).toBe("Mi Browser 14");
    expect(describeBrowser(UA.safariIos)).toBe("Safari 18");
    expect(describeBrowser(UA.chromeIos)).toBe("Chrome iOS 139");
    expect(describeBrowser(UA.webView)).toBe("Chrome 120 (WebView)");
  });

  it("repère les navigateurs intégrés, sans accuser Chrome ou Samsung Internet", () => {
    expect(isInAppBrowser(UA.webView)).toBe(true);
    expect(isInAppBrowser(UA.whatsapp)).toBe(true);
    expect(isInAppBrowser(UA.chromeAndroid)).toBe(false);
    expect(isInAppBrowser(UA.samsung)).toBe(false);
    expect(isInAppBrowser(UA.safariIos)).toBe(false);
    expect(
      isInAppBrowser(UA.chromeAndroid, { secureContext: true, hasGetUserMedia: false })
    ).toBe(true);
  });
});

describe("readCameraPolicy", () => {
  it("lit la décision de la Permissions-Policy du document", () => {
    expect(readCameraPolicy({ featurePolicy: { allowsFeature: () => false } })).toBe(false);
    expect(readCameraPolicy({ permissionsPolicy: { allowsFeature: () => true } })).toBe(true);
  });

  it("rend null quand le navigateur ne l'expose pas (Safari, Firefox)", () => {
    expect(readCameraPolicy({})).toBeNull();
    expect(
      readCameraPolicy({
        featurePolicy: {
          allowsFeature: () => {
            throw new Error("boom");
          },
        },
      })
    ).toBeNull();
  });
});

describe("queryCameraPermission", () => {
  it("rend null quand l'API ou le nom `camera` ne sont pas pris en charge", async () => {
    expect(await queryCameraPermission({})).toBeNull();
    expect(
      await queryCameraPermission({ permissions: { query: () => Promise.reject(new TypeError()) } })
    ).toBeNull();
  });

  it("rend le PermissionStatus sinon", async () => {
    const status = { state: "granted" };

    expect(
      await queryCameraPermission({ permissions: { query: () => Promise.resolve(status) } })
    ).toBe(status);
  });
});
