import { useEffect, useRef } from "react";
import { LUMINA_VERTEX_SHADER, LUMINA_FRAGMENT_SHADER } from "@/lib/emerald-horizon-shaders";

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
  speed: 1,
  waveScale: 1,
  variation: 1,
  glow: 1,
  vignette: 1,
  hue: 0,
  opacity: 1,
} as const;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create Emerald Horizon shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Emerald Horizon shader compilation failed",
    );
  }
  return shader;
}

export function EmeraldHorizon({
  className = "",
  ...props
}: EmeraldHorizonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ ...EMERALD_HORIZON_DEFAULTS, ...props });
  optionsRef.current = { ...EMERALD_HORIZON_DEFAULTS, ...props };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
    });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, LUMINA_VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, LUMINA_FRAGMENT_SHADER);
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

    const geometry = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      u_time: gl.getUniformLocation(program, "u_time"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_wave_scale: gl.getUniformLocation(program, "u_wave_scale"),
      u_variation: gl.getUniformLocation(program, "u_variation"),
      u_glow: gl.getUniformLocation(program, "u_glow"),
      u_vignette: gl.getUniformLocation(program, "u_vignette"),
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
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
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
      gl.uniform1f(uniforms.u_time, (now - start) * 0.001 * options.speed);
      gl.uniform1f(uniforms.u_wave_scale, options.waveScale);
      gl.uniform1f(uniforms.u_variation, options.variation);
      gl.uniform1f(uniforms.u_glow, options.glow);
      gl.uniform1f(uniforms.u_vignette, options.vignette);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      gl.deleteBuffer(geometry);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
    };
  }, []);

  const options = optionsRef.current;
  return (
    <div
      ref={hostRef}
      className={`emerald-horizon${className ? ` ${className}` : ""}`}
      style={{
        position: "absolute",
        inset: 0,
        opacity: options.opacity,
        filter: `hue-rotate(${options.hue}deg)`,
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
