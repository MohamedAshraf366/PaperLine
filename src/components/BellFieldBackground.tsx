import { useEffect, useRef } from "react";
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

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create Bell Field shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Bell Field shader compilation failed",
    );
  }
  return shader;
}

export function BellFieldBackground({
  className = "",
  ...props
}: BellFieldBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ ...BELL_FIELD_DEFAULTS, ...props });
  optionsRef.current = { ...BELL_FIELD_DEFAULTS, ...props };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const gl = canvas.getContext("webgl");
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, BELL_FIELD_VERTEX_SHADER);
    const fragment = compile(
      gl,
      gl.FRAGMENT_SHADER,
      BELL_FIELD_FRAGMENT_SHADER,
    );
    const program = gl.createProgram();
    if (!program) return undefined;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (
      !gl.getProgramParameter(program, gl.LINK_STATUS)
    ) {
      throw new Error(
        gl.getProgramInfoLog(program) ?? "Bell Field program link failed",
      );
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    const mouseUniform = gl.getUniformLocation(program, "u_mouse");
    const strikeUniform = gl.getUniformLocation(program, "u_strike");

    let width = 1;
    let height = 1;
    let dpr = 1;
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetX = 0.5;
    let targetY = 0.5;
    let frame = 0;
    let visible = true;
    let initialized = false;
    let lastStrikeMs = -1e9;
    const startedAt = performance.now();

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      if (!initialized) {
        mouseX = targetX = width * 0.5;
        mouseY = targetY = height * 0.5;
        initialized = true;
      }
    };

    const pointer = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      const amount = optionsRef.current.pointerAmount;
      targetX =
        width * 0.5 + (event.clientX - bounds.left - width * 0.5) * amount;
      targetY =
        height * 0.5 + (event.clientY - bounds.top - height * 0.5) * amount;
    };

    const strike = () => {
      lastStrikeMs = performance.now();
    };

    const firstStrike = window.setTimeout(strike, 1700);
    const strikeTimer = window.setInterval(strike, 8200);

    const render = (now: number) => {
      const options = optionsRef.current;
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;
      gl.uniform1f(
        time,
        (now - startedAt) * 0.001 * options.speed,
      );
      gl.uniform1f(
        strikeUniform,
        Math.min(
          1,
          Math.max(0, (now - lastStrikeMs) / options.strikeDuration),
        ),
      );
      gl.uniform2f(mouseUniform, mouseX * dpr, mouseY * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
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
    host.addEventListener("pointermove", pointer, { passive: true });
    host.addEventListener("pointerdown", strike);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(firstStrike);
      window.clearInterval(strikeTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      host.removeEventListener("pointermove", pointer);
      host.removeEventListener("pointerdown", strike);
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
      className={`bell-field${className ? ` ${className}` : ""}`}
      style={{
        position: "absolute",
        inset: 0,
        opacity: options.opacity,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
