// ─── STRICT DRAW FN TYPE (catches arity mismatches at module boundary) ───
export type DrawFn = (gl: WebGLRenderingContext, t: number, w: number, h: number, dpr: number) => void;

class WebGLManager {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private draws = new Map<string, DrawFn>();
  private rafId = 0;
  private running = false;
  private startTime = 0;
  private ctxLost = false;
  private recoveryTimer = 0;

  init() {
    if (this.canvas) return;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;display:block;pointer-events:none;z-index:-1;";
    document.body.appendChild(this.canvas);

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = this.canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) {
        gl = this.canvas.getContext("experimental-webgl", {
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
        }) as WebGLRenderingContext | null;
      }
    } catch (e) {
      console.warn("WebGL init failed:", e);
    }

    if (!gl) {
      console.warn("WebGL not available — animations disabled");
      return;
    }

    this.gl = gl;
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0, 0, 0, 0);
    this.startTime = performance.now();
    this.startLoop();

    const handleLost = () => {
      console.warn("WebGL context lost — marking unavailable");
      this.ctxLost = true;
      this.canvas = null;
      this.gl = null;
      this.running = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      this.draws.clear();
      if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    };
    this.gl.canvas.addEventListener("webglcontextlost", handleLost);
    (this as unknown as { _ctxLostHandler?: (e: Event) => void })._ctxLostHandler = handleLost;
  }

  register(id: string, draw: DrawFn) {
    this.draws.set(id, draw);
    if (!this.running && this.gl && !this.ctxLost) this.startLoop();
  }

  unregister(id: string) {
    this.draws.delete(id);
    if (this.draws.size === 0 && this.running) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      this.running = false;
    }
  }

  private loop = (now: number) => {
    if (!this.running || !this.gl || this.ctxLost) return;
    const t = (now - this.startTime) * 0.001;
    const w = this.canvas!.clientWidth;
    const h = this.canvas!.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (this.canvas!.width !== bw || this.canvas!.height !== bh) {
      this.canvas!.width = bw;
      this.canvas!.height = bh;
    }
    this.gl.viewport(0, 0, bw, bh);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    for (const draw of this.draws.values()) {
      try {
        draw(this.gl!, t, w, h, dpr);
      } catch (err) {
        console.warn("WebGL draw error:", err);
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private startLoop() {
    if (this.running || !this.gl || this.ctxLost) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.loop);
  }

  resize() {
    if (!this.canvas || !this.gl || this.ctxLost) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = 0;
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.running = false;
    const handler = (this as unknown as { _ctxLostHandler?: (e: Event) => void })._ctxLostHandler;
    if (handler && this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", handler);
    }
    this.draws.clear();
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null;
    this.gl = null;
  }

  get hasContext(): boolean {
    return !!this.gl && !this.ctxLost;
  }

  getContext(): WebGLRenderingContext | null {
    return this.gl;
  }
}

export const webgl = new WebGLManager();
export type { DrawFn };
