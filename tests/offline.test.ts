import { expect, test, vi } from "vitest";

import { createOfflineSupport } from "../assets/js/offline.ts";

function createStatusElement() {
  const label = { textContent: "Preparing offline" } as HTMLElement;
  const element = {
    dataset: {},
    hidden: true,
    querySelector: () => label,
    textContent: "",
    title: "",
  } as unknown as HTMLElement;

  return { element, label };
}

function createEventTarget() {
  const listeners = new Map<string, () => void>();
  return {
    addEventListener(type: "online" | "offline", listener: () => void) {
      listeners.set(type, listener);
    },
    dispatch(type: "online" | "offline") {
      listeners.get(type)?.();
    },
  };
}

function createRegistration() {
  return {
    installing: null,
    waiting: null,
    addEventListener: vi.fn(),
  };
}

test("source builds do not register a service worker", async () => {
  const { element } = createStatusElement();
  const register = vi.fn();

  await createOfflineSupport({
    statusElement: element,
    isProductionBuild: false,
    serviceWorker: {
      controller: null,
      ready: Promise.resolve(),
      register,
    },
    serviceWorkerUrl: "https://example.test/sw.js",
  }).start();

  expect(register).not.toHaveBeenCalled();
  expect(element.hidden).toBe(true);
});

test("production builds report when every offline asset is ready", async () => {
  const { element, label } = createStatusElement();
  const eventTarget = createEventTarget();
  const registration = createRegistration();
  const register = vi.fn().mockResolvedValue(registration);
  let online = true;

  await createOfflineSupport({
    statusElement: element,
    isProductionBuild: true,
    serviceWorker: {
      controller: {},
      ready: Promise.resolve(),
      register,
    },
    eventTarget,
    isOnline: () => online,
    serviceWorkerUrl: "https://example.test/sw.js",
  }).start();

  expect(register).toHaveBeenCalledWith("https://example.test/sw.js", {
    scope: "./",
  });
  expect(element.dataset.state).toBe("ready");
  expect(label.textContent).toBe("Ready offline");

  online = false;
  eventTarget.dispatch("offline");
  expect(element.dataset.state).toBe("offline");
  expect(label.textContent).toBe("Working offline");
});

test("registration failures are visible without breaking the application", async () => {
  const { element, label } = createStatusElement();

  await createOfflineSupport({
    statusElement: element,
    isProductionBuild: true,
    serviceWorker: {
      controller: null,
      ready: Promise.resolve(),
      register: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    },
    eventTarget: createEventTarget(),
    serviceWorkerUrl: "https://example.test/sw.js",
  }).start();

  expect(element.dataset.state).toBe("error");
  expect(label.textContent).toBe("Offline unavailable");
});
