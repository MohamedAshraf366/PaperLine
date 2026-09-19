import { useEffect, useRef } from "react";
import { AMBER_MESH_VERTEX_SHADER, AMBER_MESH_FRAGMENT_SHADER } from "@/lib/amber-mesh-shaders";

export type AmberMeshProps = {
  speed?: number;
  opacity?: number;
  className?: string;
};

export const AMBER_MESH_DEFAULTS = {
  speed: 1,
  opacity: 0.55,
} as const;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create Amber Mesh shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Amber Mesh shader compilation failed",
    );
  }
  return shader;
}

export function AmberMesh({
  className = "",
  ...props
}: AmberMeshProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ ...AMBER_MESH_DEFAULTS, ...props });
  optionsRef.current = { ...AMBER_MESH_DEFAULTS, ...props };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
    });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, AMBER_MESH_VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, AMBER_MESH_FRAGMENT_SHADER);
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
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame =
        visible && !document.hidden ? requestAnimationFrame(render) : 0;
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
      className={`amber-mesh${className ? ` ${className}` : ""}`}
      style={{
        position: "absolute",
        inset: 0,
        opacity: options.opacity,
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
