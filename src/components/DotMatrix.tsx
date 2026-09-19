import { useEffect, useRef } from "react";
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
  speed: 1,
  gridScale: 60,
  mouseAmount: 0.04,
  pulseSpeed: 0.4,
  radius: 0.15,
  opacity: 0.35,
  hue: 0,
} as const;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create Dot Matrix shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Dot Matrix shader compilation failed",
    );
  }
  return shader;
}

export function DotMatrix({
  className = "",
  ...props
}: DotMatrixProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ ...DOT_MATRIX_DEFAULTS, ...props });
  optionsRef.current = { ...DOT_MATRIX_DEFAULTS, ...props };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
    });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, CORE_UPLINK_VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, CORE_UPLINK_FRAGMENT_SHADER);
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
      uTime: gl.getUniformLocation(program, "uTime"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uMouse: gl.getUniformLocation(program, "uMouse"),
      uGridScale: gl.getUniformLocation(program, "uGridScale"),
      uMouseAmount: gl.getUniformLocation(program, "uMouseAmount"),
      uPulseSpeed: gl.getUniformLocation(program, "uPulseSpeed"),
      uRadius: gl.getUniformLocation(program, "uRadius"),
      uOpacity: gl.getUniformLocation(program, "uOpacity"),
    };
    let width = 1;
    let height = 1;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
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
      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    };

    const pointer = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      targetX =
        ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1;
      targetY = -(
        (event.clientY - bounds.top) / Math.max(1, bounds.height)
      ) * 2 + 1;
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
    resize();
    resizeObserver.disconnect();
    frame = requestAnimationFrame(render);

    const render = (now: number) => {
      const options = optionsRef.current;
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;
      gl.uniform1f(uniforms.uTime, (now - start) * 0.001 * options.speed);
      gl.uniform2f(uniforms.uMouse, mouseX, mouseY);
      gl.uniform1f(uniforms.uGridScale, options.gridScale);
      gl.uniform1f(uniforms.uMouseAmount, options.mouseAmount);
      gl.uniform1f(uniforms.uPulseSpeed, options.pulseSpeed);
      gl.uniform1f(uniforms.uRadius, options.radius);
      gl.uniform1f(uniforms.uOpacity, options.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      host.removeEventListener("pointermove", pointer);
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
      className={`dot-matrix${className ? ` ${className}` : ""}`}
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
