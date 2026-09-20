import { useEffect, useRef } from "react";
import { webgl, type DrawFn } from "@/lib/webgl-manager";
import { EMERALD_HORIZON_VERTEX_SHADER, EMERALD_HORIZON_FRAGMENT_SHADER } from "@/lib/emerald-horizon-shaders";

export type EmeraldHorizonProps = {
  speed?: number;
  waveScale?: number;
  variation?: number;
  glow?: number;
  vignette?: number;
  hue?: number;
  opacity?: number;
  className?: string;
};

export const EMERALD_HORIZON_DEFAULTS = {
  speed: 1, waveScale: 1, variation: 1, glow: 1, vignette: 1, hue: 0, opacity: 1,
} as const;

export function EmeraldHorizon({ className = "", ...props }: EmeraldHorizonProps) {
  const optionsRef = useRef({ ...EMERALD_HORIZON_DEFAULTS, ...props });
  optionsRef.current = { ...EMERALD_HORIZON_DEFAULTS, ...props };
  const idRef = useRef<string | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!webgl.hasContext) return;

    const opts = optionsRef.current;
    const gl = webgl.getContext();
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, LUMINA_VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("EmeraldHorizon vertex compile error:", gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, LUMINA_FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("EmeraldHorizon fragment compile error:", gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("EmeraldHorizon program link error:", gl.getProgramInfoLog(program));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return;
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    programRef.current = program;

    const timeLoc = gl.getUniformLocation(program, "u_time")!;
    const resolutionLoc = gl.getUniformLocation(program, "u_resolution")!;
    const waveScaleLoc = gl.getUniformLocation(program, "u_wave_scale")!;
    const variationLoc = gl.getUniformLocation(program, "u_variation")!;
    const glowLoc = gl.getUniformLocation(program, "u_glow")!;
    const vignetteLoc = gl.getUniformLocation(program, "u_vignette")!;
    const positionLoc = gl.getAttribLocation(program, "position");

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW);

    const draw: DrawFn = (gl: WebGLRenderingContext, t: number, _w: number, _h: number, dpr: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionLoc, window.innerWidth * dpr, window.innerHeight * dpr);
      gl.uniform1f(timeLoc, t * opts.speed);
      gl.uniform1f(waveScaleLoc, opts.waveScale);
      gl.uniform1f(variationLoc, opts.variation);
      gl.uniform1f(glowLoc, opts.glow);
      gl.uniform1f(vignetteLoc, opts.vignette);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const id = webgl.register("emerald-horizon", draw);
    idRef.current = id;

    destroyRef.current = () => {
      if (programRef.current) {
        gl.deleteProgram(programRef.current);
        gl.deleteBuffer(buffer);
        programRef.current = null;
      }
    };

    return () => {
      if (destroyRef.current) destroyRef.current();
      if (idRef.current) webgl.unregister(idRef.current);
      idRef.current = null;
      destroyRef.current = null;
    };
  }, []);

  return (
    <div
      className={`emerald-horizon${className ? ` ${className}` : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        opacity: optionsRef.current.opacity,
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden
    />
  );
}
