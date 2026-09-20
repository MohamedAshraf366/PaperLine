import { useEffect, useRef } from "react";
import { webgl } from "@/lib/webgl-manager";
import { CORE_UPLINK_VERTEX_SHADER, CORE_UPLINK_FRAGMENT_SHADER } from "@/lib/dot-matrix-shaders";

export type DotMatrixProps = {
  speed?: number;
  gridScale?: number;
  mouseAmount?: number;
  pulseSpeed?: number;
  radius?: number;
  opacity?: number;
  hue?: number;
  className?: string;
};

export const DOT_MATRIX_DEFAULTS = {
  speed: 1, gridScale: 60, mouseAmount: 0.04, pulseSpeed: 0.4, radius: 0.15, opacity: 0.35, hue: 0,
} as const;

export function DotMatrix({ className = "", ...props }: DotMatrixProps) {
  const optionsRef = useRef({ ...DOT_MATRIX_DEFAULTS, ...props });
  optionsRef.current = { ...DOT_MATRIX_DEFAULTS, ...props };
  const idRef = useRef<string | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const destroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!webgl.hasContext) return;

    const opts = optionsRef.current;
    const gl = webgl.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, CORE_UPLINK_VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("DotMatrix vertex compile error:", gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, CORE_UPLINK_FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("DotMatrix fragment compile error:", gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("DotMatrix program link error:", gl.getProgramInfoLog(program));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return;
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    programRef.current = program;

    const timeLoc = gl.getUniformLocation(program, "uTime")!;
    const resolutionLoc = gl.getUniformLocation(program, "uResolution")!;
    const mouseLoc = gl.getUniformLocation(program, "uMouse")!;
    const gridScaleLoc = gl.getUniformLocation(program, "uGridScale")!;
    const mouseAmountLoc = gl.getUniformLocation(program, "uMouseAmount")!;
    const pulseSpeedLoc = gl.getUniformLocation(program, "uPulseSpeed")!;
    const radiusLoc = gl.getUniformLocation(program, "uRadius")!;
    const opacityLoc = gl.getUniformLocation(program, "uOpacity")!;
    const positionLoc = gl.getAttribLocation(program, "position");

    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW);

    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handlePointer = (e: PointerEvent) => {
      const bounds = document.body.getBoundingClientRect();
      targetX = ((e.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1;
      targetY = -((e.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1;
    };

    const draw: DrawFn = (gl: WebGLRenderingContext, t: number, _w: number, _h: number, dpr: number) => {
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(timeLoc, t * opts.speed);
      gl.uniform2f(resolutionLoc, window.innerWidth * dpr, window.innerHeight * dpr);
      gl.uniform2f(mouseLoc, mouseX, mouseY);
      gl.uniform1f(gridScaleLoc, opts.gridScale);
      gl.uniform1f(mouseAmountLoc, opts.mouseAmount);
      gl.uniform1f(pulseSpeedLoc, opts.pulseSpeed);
      gl.uniform1f(radiusLoc, opts.radius);
      gl.uniform1f(opacityLoc, opts.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const id = webgl.register("dot-matrix", draw);
    idRef.current = id;

    document.addEventListener("pointermove", handlePointer);

    destroyRef.current = () => {
      document.removeEventListener("pointermove", handlePointer);
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
      className={`dot-matrix${className ? ` ${className}` : ""}`}
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
