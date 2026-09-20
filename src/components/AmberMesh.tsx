import { useEffect, useRef } from "react";
import { webgl } from "@/lib/webgl-manager";
import { AMBER_MESH_VERTEX_SHADER, AMBER_MESH_FRAGMENT_SHADER } from "@/lib/amber-mesh-shaders";

export type AmberMeshProps = {
  speed?: number;
  opacity?: number;
  className?: string;
};

export const AMBER_MESH_DEFAULTS = {
  speed: 1, opacity: 0.55,
} as const;

export function AmberMesh({ className = "", ...props }: AmberMeshProps) {
  const optionsRef = useRef({ ...AMBER_MESH_DEFAULTS, ...props });
  optionsRef.current = { ...AMBER_MESH_DEFAULTS, ...props };
  const idRef = useRef<string | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!webgl.hasContext) return;
    const opts = optionsRef.current;
    const gl = webgl.getContext!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, AMBER_MESH_VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("AmberMesh vertex compile error:", gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, AMBER_MESH_FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("AmberMesh fragment compile error:", gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("AmberMesh program link error:", gl.getProgramInfoLog(program));
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
    const positionLoc = gl.getAttribLocation(program, "position");

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW);

    const draw: DrawFn = (gl: WebGLRenderingContext, t: number) => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      const w = window.innerWidth;
      const h = window.innerHeight;
      gl.uniform2f(resolutionLoc, w * dpr, h * dpr);
      gl.uniform1f(timeLoc, t * opts.speed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const id = webgl.register("amber-mesh", draw);
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
      className={`amber-mesh${className ? ` ${className}` : ""}`}
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
