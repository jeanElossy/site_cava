import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// Même fonction à chaque rechargement du module (voir loadScanner) :
// sans `vi.hoisted`, le composant rechargé recevrait un autre mock que
// celui manipulé par le test.
const jsQRMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("jsqr", () => ({ default: jsQRMock }));

// Le composant retient, au niveau du module, qu'une caméra a déjà été
// obtenue dans la page. Chaque test repart d'un module neuf.
const loadScanner = async () => {
  vi.resetModules();

  return (await import("./QrCameraScanner")).default;
};

const domError = (name, message = "") => new DOMException(message, name);

const makeStream = ({
  label = "camera2 0, facing back",
  deviceId = "back-0",
  facingMode = "environment",
} = {}) => {
  const listeners = {};
  const track = {
    kind: "video",
    label,
    stop: vi.fn(),
    getSettings: () => ({ deviceId, facingMode, width: 1280, height: 720 }),
    getCapabilities: () => ({}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
    fire: (type) => listeners[type]?.(),
  };

  return { track, getTracks: () => [track], getVideoTracks: () => [track] };
};

const installCamera = ({ permission = "prompt", getUserMedia, devices } = {}) => {
  const permissionListeners = [];
  const permissionStatus = {
    state: permission,
    addEventListener: (type, listener) => permissionListeners.push(listener),
    removeEventListener: vi.fn(),
    change(state) {
      this.state = state;
      permissionListeners.forEach((listener) => listener());
    },
  };

  const mediaDevices = {
    getUserMedia: getUserMedia ?? vi.fn(async () => makeStream()),
    enumerateDevices: vi.fn(
      async () =>
        devices ?? [{ kind: "videoinput", deviceId: "back-0", label: "camera2 0, facing back" }]
    ),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: mediaDevices });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn(async () => permissionStatus) },
  });

  return { mediaDevices, permissionStatus };
};

const statusOf = (container) =>
  container.querySelector(".qr-camera-scanner").dataset.status;

const setVisibility = (state) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  window.sessionStorage.clear();
  jsQRMock.mockReset();
  jsQRMock.mockReturnValue(null);

  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });

  // jsdom ne lit pas de vidéo : on simule un flux qui a déjà une image.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 720 });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 16);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.featurePolicy;
});

describe("QrCameraScanner — démarrage et autorisation", () => {
  it("attend « Activer la caméra » tant que l'autorisation n'est pas acquise, puis démarre au clic", async () => {
    const { mediaDevices } = installCamera({ permission: "prompt" });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    const button = await screen.findByRole("button", { name: /activer la caméra/i });

    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(button);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(mediaDevices.getUserMedia.mock.calls[0][0].video.facingMode).toEqual({
      ideal: "environment",
    });
  });

  it("démarre seule quand l'autorisation est déjà accordée", async () => {
    const { mediaDevices } = installCamera({ permission: "granted" });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(screen.queryByRole("button", { name: /activer la caméra/i })).toBeNull();
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("autorisation refusée : pas de bouton inutile, la cause s'affiche aussitôt (une seule tentative)", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(domError("NotAllowedError", "Permission denied"));
    installCamera({ permission: "denied", getUserMedia });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/refusé/);
    expect(screen.queryByRole("button", { name: /activer la caméra/i })).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("un double appui sur « Activer » ne lance qu'une seule demande", async () => {
    let resolveStream;
    const getUserMedia = vi.fn(
      () => new Promise((resolve) => {
        resolveStream = resolve;
      })
    );
    const { mediaDevices } = installCamera({ permission: "prompt", getUserMedia });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    const button = await screen.findByRole("button", { name: /activer la caméra/i });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Activation de la caméra…");

    await act(async () => resolveStream(makeStream()));
    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("essaie la contrainte suivante après un OverconstrainedError", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(domError("OverconstrainedError"))
      .mockResolvedValueOnce(makeStream());
    installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toEqual({ video: true, audio: false });
  });

  it("bascule une fois sur la caméra arrière quand le navigateur a ouvert l'avant", async () => {
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(
        makeStream({ label: "camera2 1, facing front", deviceId: "front", facingMode: "user" })
      )
      .mockResolvedValue(makeStream());
    installCamera({
      permission: "granted",
      getUserMedia,
      devices: [
        { kind: "videoinput", deviceId: "front", label: "camera2 1, facing front" },
        { kind: "videoinput", deviceId: "back-0", label: "camera2 0, facing back" },
      ],
    });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia.mock.calls[1][0].video.deviceId).toEqual({ exact: "back-0" });
    expect(await screen.findByRole("button", { name: /changer de caméra/i })).toBeInTheDocument();
  });
});

describe("QrCameraScanner — erreurs", () => {
  it("affiche un refus sans redemander en boucle ; « Réessayer » relance une seule fois", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(domError("NotAllowedError", "Permission denied"));
    installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/refusé/);
    expect(screen.getByText(/NotAllowedError · Permission denied/)).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });

  it("dit que la caméra est bloquée par le site quand la Permissions-Policy l'interdit", async () => {
    document.featurePolicy = { allowsFeature: () => false };
    const getUserMedia = vi.fn().mockRejectedValue(domError("NotAllowedError", "Permission denied"));
    installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/configuration du site/);
  });

  it("signale une caméra occupée par une autre application", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(domError("NotReadableError", "Could not start video source"));
    installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/déjà utilisée par une autre application/);
  });

  it("sans navigator.mediaDevices (cas A) : consigne immédiate, sans bouton inutile", async () => {
    installCamera({ permission: "prompt" });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Google Chrome/);
    expect(screen.getByText(/mediaDevices indisponible/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activer la caméra/i })).toBeNull();
  });

  it("hors https : le dit explicitement", async () => {
    installCamera({ permission: "prompt" });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/https/);
  });

  it("une piste coupée par le système passe en échec avec « Réessayer »", async () => {
    const stream = makeStream();
    installCamera({ permission: "granted", getUserMedia: vi.fn().mockResolvedValue(stream) });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));

    act(() => stream.track.fire("ended"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/s'est arrêtée/);
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });

  it("l'autorisation accordée dans les réglages relance la caméra, sans geste", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(domError("NotAllowedError", "Permission denied"))
      .mockResolvedValue(makeStream());
    const { permissionStatus } = installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await screen.findByRole("alert");

    act(() => permissionStatus.change("granted"));

    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});

describe("QrCameraScanner — cycle de vie du flux", () => {
  it("le démontage (changement de page) arrête toutes les pistes", async () => {
    const stream = makeStream();
    installCamera({ permission: "granted", getUserMedia: vi.fn().mockResolvedValue(stream) });
    const QrCameraScanner = await loadScanner();
    const { container, unmount } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));

    unmount();

    expect(stream.track.stop).toHaveBeenCalled();
  });

  it("une pause courte garde la caméra ouverte : aucune nouvelle demande à la reprise", async () => {
    const stream = makeStream();
    const { mediaDevices } = installCamera({
      permission: "granted",
      getUserMedia: vi.fn().mockResolvedValue(stream),
    });
    const QrCameraScanner = await loadScanner();
    const { container, rerender } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));

    rerender(<QrCameraScanner active={false} onDecode={vi.fn()} />);
    rerender(<QrCameraScanner active onDecode={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(stream.track.stop).not.toHaveBeenCalled();
    expect(statusOf(container)).toBe("ready");
  });

  it("une pause prolongée libère la caméra, rouverte seule à la reprise", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const first = makeStream();
    const getUserMedia = vi.fn().mockResolvedValueOnce(first).mockResolvedValue(makeStream());
    installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    const { container, rerender } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));

    rerender(<QrCameraScanner active={false} onDecode={vi.fn()} />);
    await act(async () => {
      vi.advanceTimersByTime(16000);
    });

    expect(first.track.stop).toHaveBeenCalled();
    expect(statusOf(container)).toBe("off");

    rerender(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("page masquée (écran verrouillé) : caméra libérée, puis rouverte au retour", async () => {
    const first = makeStream();
    const getUserMedia = vi.fn().mockResolvedValueOnce(first).mockResolvedValue(makeStream());
    installCamera({ permission: "granted", getUserMedia });
    const QrCameraScanner = await loadScanner();
    const { container } = render(<QrCameraScanner active onDecode={vi.fn()} />);

    await waitFor(() => expect(statusOf(container)).toBe("ready"));

    act(() => setVisibility("hidden"));
    expect(first.track.stop).toHaveBeenCalled();

    act(() => setVisibility("visible"));
    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("propose « Réessayer » quand getUserMedia ne répond jamais", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    installCamera({ permission: "granted", getUserMedia: vi.fn(() => new Promise(() => {})) });
    const QrCameraScanner = await loadScanner();
    render(<QrCameraScanner active onDecode={vi.fn()} />);

    await screen.findByText("Activation de la caméra…");
    await act(async () => {
      vi.advanceTimersByTime(10500);
    });

    expect(screen.getByText(/aucune demande d'autorisation ne s'affiche/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });
});

describe("QrCameraScanner — décodage", () => {
  const fakeContext = {
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };

  it("appelle le onDecode le plus récent, et ne relit pas un QR resté dans le cadre", async () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValue(fakeContext);
    jsQRMock.mockReturnValue({ data: "BADGE-1" });
    installCamera({ permission: "granted" });

    const first = vi.fn();
    const latest = vi.fn();
    const QrCameraScanner = await loadScanner();
    const { rerender } = render(<QrCameraScanner active onDecode={first} />);

    rerender(<QrCameraScanner active onDecode={latest} />);

    await waitFor(() => expect(latest).toHaveBeenCalledWith("BADGE-1"));
    expect(first).not.toHaveBeenCalled();

    // Le badge reste devant l'objectif : plusieurs passes, une seule lecture.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("ne décode rien pendant une pause", async () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValue(fakeContext);
    jsQRMock.mockReturnValue({ data: "BADGE-1" });
    installCamera({ permission: "granted" });

    const onDecode = vi.fn();
    const QrCameraScanner = await loadScanner();
    const { container, rerender } = render(<QrCameraScanner active={false} onDecode={onDecode} />);

    rerender(<QrCameraScanner active onDecode={onDecode} />);
    await waitFor(() => expect(statusOf(container)).toBe("ready"));
    rerender(<QrCameraScanner active={false} onDecode={onDecode} />);
    onDecode.mockClear();

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onDecode).not.toHaveBeenCalled();
  });
});
