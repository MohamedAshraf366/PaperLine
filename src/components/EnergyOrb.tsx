import { useEffect, useRef } from "react";
import { webgl, type DrawFn } from "@/lib/webgl-manager";
import { ENERGY_ORB_VERTEX_SHADER, ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER } from "@/lib/energy-orb-shaders";

export type EnergyOrbProps = {
  speed?: number;
  scale?: number;
  hue?: number;
  saturation?: number;
  glow?: number;
  opacity?: number;
  className?: string;
};

export const ENERGY_ORB_DEFAULTS = {
  speed: 1, scale: 1, hue: 0, saturation: 1, glow: 1, opacity: 1,
} as const;

export function EnergyOrb({ className = "", ...props }: EnergyOrbProps) {
  const optionsRef = useRef({ ...ENERGY_ORB_DEFAULTS, ...props });
  optionsRef.current = { ...ENERGY_ORB_DEFAULTS, ...props };
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
    gl.shaderSource(vertexShader, ENERGY_ORB_VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("EnergyOrb vertex compile error:", gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("EnergyOrb fragment compile error:", gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("EnergyOrb program link error:", gl.getProgramInfoLog(program));
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
    const hueLoc = gl.getUniformLocation(program, "u_hue")!;
    const saturationLoc = gl.getUniformLocation(program, "u_sat")!;
    const brightnessLoc = gl.getUniformLocation(program, "u_brightness")!;
    const opacityLoc = gl.getUniformLocation(program, "u_opacity")!;
    const scaleLoc = gl.getUniformLocation(program, "u_scale")!;
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
      gl.uniform1f(hueLoc, optionsRef.current.hue * Math.PI / 180);
      gl.uniform1f(saturationLoc, optionsRef.current.saturation);
      gl.uniform1f(brightnessLoc, 1);
      gl.uniform1f(opacityLoc, optionsRef.current.opacity);
      gl.uniform1f(scaleLoc, optionsRef.current.scale);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const id = webgl.register("energy-orb", draw);
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
      className={`energy-orb${className ? ` ${className}` : ""}`}
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
