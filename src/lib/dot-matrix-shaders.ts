export const CORE_UPLINK_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;

export const CORE_UPLINK_FRAGMENT_SHADER = `
                precision highp float;
                varying vec2 vUv;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform float u_gridScale;
                uniform vec2 u_mouse;
                uniform float u_mouseAmount;
                uniform float u_pulseSpeed;
                uniform float u_radius;
                uniform float u_opacity;
                uniform float u_hue;
                uniform float u_bg;
                uniform float u_fg;

                vec3 h2r(float hue) {
                  vec3 rgb = clamp(abs(vec3(
                    0.8 + 0.2 * cos(6.28318 * (hue + 0.00)),
                    0.8 + 0.2 * cos(6.28318 * (hue + 0.33)),
                    0.8 + 0.2 * cos(6.28318 * (hue + 0.67))
                  )), 0.0, 1.0);
                  return pow(rgb, vec3(1.0 / 2.2));
                }

                void main() {
                  vec2 uv = vUv;
                  vec2 res = u_resolution;
                  float scl = u_gridScale;
                  vec2 mouse = u_mouse;
                  float mouseAmount = u_mouseAmount;
                  float time = u_time;
                  float pulseSpeed = u_pulseSpeed;
                  float radius = u_radius;
                  float op = u_opacity;
                  float hue = u_hue;
                  float bg = u_bg;
                  float fg = u_fg;

                  float rr = length(mouse);
                  vec2 ruv = mouse / (rr + 0.001);
                  float angleDiff = abs(atan(uv.y - 0.5, uv.x - 0.5) - atan(ruv.y, ruv.x));
                  float dist = length(uv - mouse) * 2.0;
                  float decay = 1.0 - dist / (radius * 2.0);
                  decay = clamp(decay, 0.0, 1.0) * clamp(1.0 - mouseAmount * 3.0, 0.0, 1.0) * mouseAmount * 3.0;

                  vec2 uv_scaled = uv * vec2(scl, -scl);
                  vec2 grid = fract(uv_scaled * 2.0) - 0.5;
                  vec2 dist_to_center = vec2(2.0 * uv.x - 1.0, 2.0 * uv.y - 1.0);
                  float glow = exp(-4.0 * length(dist_to_center));

                  vec3 col = mix(vec3(bg), vec3(fg), glow);
                  float grid_intensity = 0.5 + 0.5 * cos(time * pulseSpeed + uv_scaled.x + uv_scaled.y);
                  col += vec3(0.5) * grid_intensity * grid.x * grid.y * 0.02;

                  float pulse = 0.0;
                  for (int i = 1; i <= 6; i++) {
                    float fi = float(i);
                    pulse += (0.5 + 0.5 * cos(time * pulseSpeed * (1.5 + fi * 0.2) + uv_scaled.x * 1.3 + uv_scaled.y * 0.7 + fi * 0.5)) * (1.0 / fi) * 0.015;
                  }
                  float wave = 0.5 + 0.5 * sin(time * pulseSpeed * 1.7 + uv_scaled.x * 2.0 + uv_scaled.y * 2.0);
                  float wave2 = 0.5 + 0.5 * cos(time * pulseSpeed * 2.3 + uv_scaled.x * 3.0 - uv_scaled.y * 2.0);
                  col += vec3(0.3) * wave * wave2 * 0.01;
                  col += vec3(h2r(hue + decay * 0.0), h2r(hue + decay * 0.33), h2r(hue + decay * 0.67)) * decay * 0.04;
                  col += vec3(h2r(hue), h2r(hue + 0.0), h2r(hue + 0.0)) * pulse * 0.03;

                  float dist_col = length(uv - mouse) * 2.0;
                  float falloff_col = exp(-dist_col * 1.5);
                  vec3 accent = h2r(vec3(0.0, 0.33, 0.67) + vec3(0.0, 0.1, 0.2) * (1.0 - falloff_col));
                  col += accent * falloff_col * 0.15 * (0.5 + 0.5 * sin(time * 0.5));

                  col += vec3(1.0) * glow * 0.2 * op;
                  col = mix(col, vec3(0.9, 0.9, 1.0), glow * 0.15);
                  col = mix(col, vec3(bg), 0.2 * (1.0 - op));
                  col = clamp(col, 0.0, 1.0);

                  gl_FragColor = vec4(col, op);
                }
              `;
