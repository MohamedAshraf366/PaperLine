import { useEffect, useRef } from "react";
import { webgl } from "@/lib/webgl-manager";

export function WebGLHost() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    try {
      webgl.init();
    } catch (err) {
      console.warn("WebGLHost: WebGL unavailable, animations disabled", err);
    }
    return () => {
      webgl.dispose();
    };
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => webgl.resize());
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden
    />
  );
}
