"use client";

import { useEffect, useRef, useState } from "react";

export function PwaRegistration() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false; let hasController = Boolean(navigator.serviceWorker.controller); let updateTimer: ReturnType<typeof setInterval> | undefined;
    const onControllerChange = () => { if (!hasController) { hasController = true; return; } if (reloading) return; reloading = true; window.location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => { void registration.update(); updateTimer = setInterval(() => void registration.update(), 15 * 60 * 1000); }).catch((error) => console.error("Service worker registration failed", error));
    return () => { navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange); if (updateTimer) clearInterval(updateTimer); };
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const scroller = document.getElementById("mainContent"); if (!scroller) return;
    let startY = 0; let pulling = false;
    const start = (event: TouchEvent) => { if (scroller.scrollTop > 0 || event.touches.length !== 1) return; startY = event.touches[0].clientY; pulling = true; };
    const move = (event: TouchEvent) => { if (!pulling) return; const distance = Math.max(0, Math.min(120, (event.touches[0].clientY - startY) * .55)); if (distance > 0) event.preventDefault(); pullDistanceRef.current = distance; setPullDistance(distance); };
    const end = () => { if (!pulling) return; pulling = false; if (pullDistanceRef.current >= 72) { setRefreshing(true); window.location.reload(); } else { pullDistanceRef.current = 0; setPullDistance(0); } };
    scroller.addEventListener("touchstart", start, { passive: true }); scroller.addEventListener("touchmove", move, { passive: false }); scroller.addEventListener("touchend", end, { passive: true });
    return () => { scroller.removeEventListener("touchstart", start); scroller.removeEventListener("touchmove", move); scroller.removeEventListener("touchend", end); };
  }, []);

  return <div className={pullDistance > 0 || refreshing ? "pwa-pull-indicator pwa-pull-visible" : "pwa-pull-indicator"} style={{ transform: `translate(-50%, ${Math.max(-48, pullDistance - 48)}px)` }}><i className={refreshing ? "ti ti-loader-2 pwa-pull-spin" : "ti ti-arrow-down"} /><span>{refreshing ? "Refreshing..." : pullDistance >= 72 ? "Release to refresh" : "Pull to refresh"}</span></div>;
}
