// ─── Shared WebGL singleton ──────────────────────────────────────────────
// One canvas + one GL context for the whole page, created once by WebGLHost.
// Every animation component registers a shader program + draw callback.
// One RAF loop draws all registered draws each frame.
// This fixes "Too many active WebGL contexts" (browser cap ~16) — we
// only ever create ONE WebGL context for the page.

type DrawFn = (gl: WebGLRenderingContext, t: number) => void;

class WebGLManager {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private draws = new Map<string, DrawFn>();
  private rafId = 0;
  private running = false;
  private startTime = 0;
  private recoveryTimer = 0;

  init() {
    if (this.canvas) return;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;display:block;pointer-events:none;";
    document.body.appendChild(this.canvas);

    let gl = this.canvas.getContext("webgl", {
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

    // Context loss recovery
    const handleLost = () => {
      console.warn("WebGL context lost — attempting recovery");
      this.ctxLost = true;
      this.dispose();
      this.ctxLost = false;
      // Attempt re-init after short delay
      this.recoveryTimer = window.setTimeout(() => {
        this.canvas = null;
        this.gl = null;
        this.init();
      }, 1000);
    };
    this.gl.canvas.addEventListener("webglcontextlost", handleLost);
    // Store so we can remove on dispose
    (this as unknown as { _ctxLostHandler?: (e: Event) => void })._ctxLostHandler = handleLost;
  }

  register(id: string, draw: DrawFn) {
    this.draws.set(id, draw);
    if (!this.running && this.gl) this.startLoop();
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
    if (!this.running || !this.gl) return;
    const t = (now - this.startTime) * 0.001;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    for (const draw of this.draws.values()) {
      try {
        draw(this.gl!, t);
      } catch (err) {
        console.warn("WebGL draw error:", err);
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private startLoop() {
    if (this.running || !this.gl) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.loop);
  }

  dispose() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = 0;
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.running = false;
    const ctxLostHandler = (this as unknown as { _ctxLostHandler?: (e: Event) => void })._ctxLostHandler;
    if (ctxLostHandler && this.canvas) {
      this.canvas.removeEventListener("webglcontextlost", ctxLostHandler);
    }
    this.draws.clear();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.gl = null;
  }

  get hasContext(): boolean {
    return this.gl !== null;
  }

  getContext(): WebGLRenderingContext | null {
    return this.gl;
  }
}

export const webgl = new WebGLManager();
export type { DrawFn };
