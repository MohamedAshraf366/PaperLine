import { useEffect, useRef } from "react";
import { NXA_ENERGY_ORB_VERTEX_SHADER, NXA_ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER } from "@/lib/energy-orb-shaders";

export type EnergyOrbProps = {
  speed?: number;
  scale?: number;
  hue?: number;
  saturation?: number;
  glow?: number;
  starDensity?: number;
  opacity?: number;
  className?: string;
};

export const ENERGY_ORB_DEFAULTS = {
  speed: 1,
  scale: 1,
  hue: 0,
  saturation: 1,
  glow: 1,
  starDensity: 1,
  opacity: 1,
} as const;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create Energy Orb shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Energy Orb shader compilation failed",
    );
  }
  return shader;
}

export function EnergyOrb({
  className = "",
  ...props
}: EnergyOrbProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ ...ENERGY_ORB_DEFAULTS, ...props });
  optionsRef.current = { ...ENERGY_ORB_DEFAULTS, ...props };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
    });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, NXA_ENERGY_ORB_VERTEX_SHADER);
    const fragment = compile(
      gl,
      gl.FRAGMENT_SHADER,
      NXA_ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER,
    );
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return undefined;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
      return undefined;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      time: gl.getUniformLocation(program, "uT"),
      resolution: gl.getUniformLocation(program, "uR"),
      hue: gl.getUniformLocation(program, "uHue"),
      saturation: gl.getUniformLocation(program, "uSaturation"),
      glow: gl.getUniformLocation(program, "uGlow"),
    };

    let width = 1;
    let height = 1;
    let frame = 0;
    let visible = true;
    let start = performance.now();

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible && !frame) frame = requestAnimationFrame(render);
        if (!visible && frame)
          cancelAnimationFrame(frame), (frame = 0);
      },
    );
    resizeObserver.observe(host);
    intersection.observe(host);
    resize();
    resizeObserver.disconnect();
    frame = requestAnimationFrame(render);

    const render = (now: number) => {
      const options = optionsRef.current;
      gl.uniform1f(uniforms.time, (now - start) * 0.001 * options.speed);
      if (uniforms.hue) gl.uniform1f(uniforms.hue, options.hue * Math.PI / 180);
      if (uniforms.saturation) gl.uniform1f(uniforms.saturation, options.saturation);
      if (uniforms.glow) gl.uniform1f(uniforms.glow, options.glow);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bounds = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
    };
  }, []);

  const options = optionsRef.current;
  return (
    <div
      ref={hostRef}
      className={`energy-orb${className ? ` ${className}` : ""}`}
      style={{
        position: "absolute",
        inset: 0,
        opacity: options.opacity,
        filter: `hue-rotate(${options.hue}deg) saturate(${options.saturation})`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
