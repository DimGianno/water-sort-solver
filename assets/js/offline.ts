/// <reference types="vite/client" />

type OfflineState =
  "preparing" | "ready" | "offline" | "unsupported" | "error" | "update";

interface WorkerLike {
  state: ServiceWorkerState;
  addEventListener: (type: "statechange", listener: () => void) => void;
}

interface RegistrationLike {
  installing?: WorkerLike | null;
  waiting?: WorkerLike | null;
  addEventListener: (type: "updatefound", listener: () => void) => void;
}

interface ServiceWorkerContainerLike {
  controller: unknown;
  ready: Promise<unknown>;
  register: (
    scriptURL: string,
    options?: RegistrationOptions,
  ) => Promise<RegistrationLike>;
}

interface EventTargetLike {
  addEventListener: (type: "online" | "offline", listener: () => void) => void;
}

interface OfflineSupportOptions {
  statusElement: HTMLElement;
  isProductionBuild: boolean;
  serviceWorker?: ServiceWorkerContainerLike;
  eventTarget?: EventTargetLike;
  isOnline?: () => boolean;
  serviceWorkerUrl?: string;
}

const STATUS_COPY: Record<OfflineState, { label: string; title: string }> = {
  preparing: {
    label: "Preparing offline",
    title: "Saving Chromaflow for use without an internet connection.",
  },
  ready: {
    label: "Ready offline",
    title:
      "Chromaflow and its solver are available without an internet connection.",
  },
  offline: {
    label: "Working offline",
    title: "Chromaflow is running from files saved on this device.",
  },
  unsupported: {
    label: "Online only",
    title: "This browser does not support reliable offline access.",
  },
  error: {
    label: "Offline unavailable",
    title:
      "Chromaflow could not finish saving the files required for offline use.",
  },
  update: {
    label: "Update ready",
    title:
      "A new Chromaflow version is ready. Close all Chromaflow tabs and reopen it to update.",
  },
};

export function createOfflineSupport(options: OfflineSupportOptions) {
  const {
    statusElement,
    isProductionBuild,
    serviceWorker = globalThis.navigator?.serviceWorker,
    eventTarget = globalThis.window,
    isOnline = () => globalThis.navigator?.onLine !== false,
    serviceWorkerUrl = new URL(
      "sw.js",
      globalThis.document?.baseURI,
    ).toString(),
  } = options;
  const label = statusElement.querySelector<HTMLElement>(
    "[data-offline-label]",
  );
  let ready = false;

  function render(state: OfflineState): void {
    const copy = STATUS_COPY[state];
    statusElement.hidden = false;
    statusElement.dataset.state = state;
    statusElement.title = copy.title;
    if (label) label.textContent = copy.label;
    else statusElement.textContent = copy.label;
  }

  function renderConnection(): void {
    if (!ready) return;
    render(isOnline() ? "ready" : "offline");
  }

  function watchForUpdate(registration: RegistrationLike): void {
    const observeInstallingWorker = (): void => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && serviceWorker?.controller) {
          render("update");
        }
      });
    };

    registration.addEventListener("updatefound", observeInstallingWorker);
    if (registration.waiting && serviceWorker?.controller) render("update");
  }

  async function start(): Promise<void> {
    if (!isProductionBuild) return;
    if (!serviceWorker) {
      render("unsupported");
      return;
    }

    render("preparing");
    eventTarget?.addEventListener("online", renderConnection);
    eventTarget?.addEventListener("offline", renderConnection);

    try {
      const registration = await serviceWorker.register(serviceWorkerUrl, {
        scope: "./",
      });
      watchForUpdate(registration);
      await serviceWorker.ready;
      ready = true;
      renderConnection();
    } catch {
      render("error");
    }
  }

  return { start };
}
