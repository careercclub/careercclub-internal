"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    let hasController = Boolean(navigator.serviceWorker.controller);
    let updateTimer: ReturnType<typeof setInterval> | undefined;

    const onControllerChange = () => {
      if (!hasController) {
        hasController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      updateTimer = setInterval(() => void registration.update(), 60 * 60 * 1000);
    }).catch((error) => {
      console.error("Service worker registration failed", error);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (updateTimer) clearInterval(updateTimer);
    };
  }, []);

  return null;
}
