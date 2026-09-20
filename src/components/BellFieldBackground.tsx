import { useEffect, useRef } from "react";
import { webgl, type DrawFn } from "@/lib/webgl-manager";
import {
  BELL_FIELD_VERTEX_SHADER,
  BELL_FIELD_FRAGMENT_SHADER,
} from "@/lib/bell-field-shaders";

export type BellFieldBackgroundProps = {
  speed?: number;
  pointerAmount?: number;
  strikeDuration?: number;
  opacity?: number;
  className?: string;
};

export const BELL_FIELD_DEFAULTS = {
  speed: 1,
  pointerAmount: 1,
  strikeDuration: 2400,
  opacity: 1,
} as const;

export function BellFieldBackground({
  className = "",
  ...props
}: BellFieldBackgroundProps) {
  const optionsRef = useRef({ ...BELL_FIELD_DEFAULTS, ...props });
  optionsRef.current = { ...BELL_FIELD_DEFAULTS, ...props };
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
    gl.shaderSource(vertexShader, BELL_FIELD_VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(vertexShader);
      console.error("BellField vertex shader compile error:", log);
      gl.deleteShader(vertexShader);
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, BELL_FIELD_FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(fragmentShader);
      console.error("BellField fragment shader compile error:", log);
      gl.deleteShader(fragmentShader);
      gl.deleteShader(vertexShader);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      console.error("BellField program link error:", log);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return;
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    programRef.current = program;

    const resolutionLoc = gl.getUniformLocation(program, "u_resolution")!;
    const timeLoc = gl.getUniformLocation(program, "u_time")!;
    const mouseLoc = gl.getUniformLocation(program, "u_mouse")!;
    const strikeLoc = gl.getUniformLocation(program, "u_strike")!;
    const positionLoc = gl.getAttribLocation(program, "position");

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW);

    let mouseX = window.innerWidth * 0.5;
    let mouseY = window.innerHeight * 0.5;
    let lastStrikeMs = -1e9;

    const strikeTimer = window.setInterval(() => {
      lastStrikeMs = performance.now();
    }, 8000);

    const draw: DrawFn = (gl: WebGLRenderingContext, t: number, _w: number, _h: number, dpr: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionLoc, window.innerWidth * dpr, window.innerHeight * dpr);
      gl.uniform1f(timeLoc, t * opts.speed);
      gl.uniform2f(mouseLoc, mouseX * dpr, mouseY * dpr);
      const strike = Math.min(1, Math.max(0, (performance.now() - lastStrikeMs) / opts.strikeDuration));
      gl.uniform1f(strikeLoc, strike);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const id = webgl.register("bell-field", draw);
    idRef.current = id;

    destroyRef.current = () => {
      window.clearInterval(strikeTimer);
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
      className={`bell-field${className ? ` ${className}` : ""}`}
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
