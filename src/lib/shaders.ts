export const GEMINI_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;
export const GEMINI_FRAGMENT_SHADER = `
                precision highp float;
                varying vec2 vUv;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform float u_wave_scale;
                uniform float u_bg;
                uniform float u_fg;
                uniform float u_glow;
                uniform float u_vignette;

                vec3 palette(float t) {
                  vec3 a = vec3(0.5, 0.5, 0.5);
                  vec3 b = vec3(0.5, 0.5, 0.5);
                  vec3 c = vec3(1.0, 1.0, 1.0);
                  vec3 d = vec3(0.00, 0.33, 0.67);
                  return a + b * cos(6.28318 * (c * t + d));
                }
                vec3 palette2(float t) {
                  vec3 a = vec3(0.5, 0.5, 0.5);
                  vec3 b = vec3(0.5, 0.5, 0.5);
                  vec3 c = vec3(1.0, 1.0, 1.0);
                  vec3 d = vec3(0.0, 0.10, 0.20);
                  return a + b * cos(6.28318 * (c * t + d));
                }
                void main() {
                  vec2 uv = vUv * 2.0 - 1.0;
                  float scale = u_wave_scale;
                  float variation = u_time * 0.1 + u_vignette;
                  float wave1 = sin(uv.x * scale * 3.0 + u_time) * cos(uv.y * scale * 3.0 - u_time);
                  float wave2 = sin(uv.y * scale * 4.0 + u_time * 0.8) * cos(uv.x * scale * 4.0 - u_time);
                  float waveSum = wave1 + wave2 + variation;
                  float intensity = (waveSum * 0.5 + 0.5) * u_glow;

                  vec3 col = palette(intensity + variation);
                  col += palette2(intensity) * 0.4;
                  col *= (1.8 - 4.0 * length(uv)) * u_vignette;
                  col = mix(vec3(0.02, 0.02, 0.02), col, intensity);
                  float v = smoothstep(0.85, u_vignette, length(vUv - 0.5) * 1.8);
                  col = mix(vec3(0.02, 0.02, 0.02), col, v * 0.8);
                  col = abs(col - vec3(0.5)) * 2.5;
                  col = sqrt(col);
                  float pv = (0.5 - abs(uv.x)) * (0.5 - abs(uv.y));
                  col += col * pv * 0.05;
                  gl_FragColor = vec4(col, 1.0);
                }
              `;
export const ENERGY_ORB_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;
export const ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER = `
                precision highp float;
                varying vec2 vUv;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform float u_hue;
                uniform float u_sat;
                uniform float u_brightness;
                uniform float u_opacity;

                void main() {
                  vec2 uv = vUv * 2.0 - 1.0;
                  float t = u_time * 0.03;

                  vec2 p = uv;
                  float d = length(p);
                  float f = 7.0;
                  float spikes = abs(sin(vec2(
                    atan(p.y, p.x) * f + t,
                    log(length(p) + 1.0) * 0.3
                  )));
                  float orb = smoothstep(0.35, 0.25, d) * (0.5 + 0.5 * cos(t * 0.5));
                  float spikePattern = pow(0.5 + 0.5 * spikes, 8.0 + 4.0 * sin(t * 0.3) + 4.0 * cos(t * 0.21));
                  spikePattern *= smoothstep(1.0, 0.0, d);

                  float centerGlow = exp(-d * 3.0) * (0.5 + 0.5 * sin(t * 0.7));
                  float starField = 0.0;
                  for (int i = 0; i < 50; i++) {
                    float fi = float(i);
                    float sx = fract(sin(fi * 12.9898) * 43758.5453);
                    float sy = fract(sin(fi * 78.233) * 43758.5453);
                    float sz = fract(sin(fi * 41.234) * 43758.5453);
                    vec2 starPos = vec2(sx - 0.5, sy - 0.5) * 2.0;
                    float starD = length(p - starPos);
                    float phase = fi * 1.7 + t * (1.0 + sz);
                    float twinkle = 0.5 + 0.5 * sin(phase);
                    starField += smoothstep(0.04, 0.0, starD) * twinkle * 0.5 * (1.0 - smoothstep(0.0, 0.5, d));
                  }

                  float angle = atan(p.y, p.x);
                  float radialGlow = exp(-d * 2.0) * (0.6 + 0.4 * sin(t * 0.4 + angle * 2.0));
                  radialGlow *= 1.0 - smoothstep(0.5, 0.0, d);

                  vec3 color = vec3(
                    0.66 + 0.34 * cos(u_hue),
                    0.77 - 0.47 * u_sat,
                    0.41 - 0.31 * u_sat
                  );

                  color += vec3(0.3, 0.5, 0.8) * spikePattern * 0.2 * u_brightness;
                  color += vec3(0.6, 0.7, 1.0) * centerGlow * 0.3 * u_brightness;
                  color += vec3(1.0, 0.95, 0.85) * starField * 0.4 * u_brightness * u_sat;
                  color += vec3(1.0, 0.85, 0.65) * radialGlow * 0.2 * u_brightness;

                  color = pow(color, vec3(1.0 / 2.2));
                  color *= u_brightness;
                  color = clamp(color, 0.0, 1.0);
                  color *= u_opacity;

                  gl_FragColor = vec4(color, u_opacity);
                }
              `;
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
export const BELL_FIELD_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;
export const BELL_FIELD_FRAGMENT_SHADER = `
                precision highp float;
                varying vec2 vUv;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform vec2 u_mouse;
                uniform float u_strike;

                void main() {
                  vec2 uv = vUv * 2.0 - 1.0;
                  float t = u_time * 0.2;

                  vec2 mouse = u_mouse * 2.0 - 1.0;
                  float dist = length(uv - mouse);
                  float wave = sin(dist * 8.0 - t) * 0.5 + 0.5;
                  float strikeWave = exp(-dist * 3.0) * (0.5 + 0.5 * sin(u_strike * 30.0)) * u_strike;

                  vec3 color = mix(vec3(0.02, 0.03, 0.08), vec3(0.1, 0.5, 0.7), wave * 0.3);
                  color += vec3(0.2, 0.6, 0.9) * strikeWave * 0.6;
                  color += vec3(0.4, 0.8, 1.0) * exp(-dist * 6.0) * (0.5 + 0.5 * sin(t)) * 0.2;

                  float vignette = 1.0 - length(uv) * 0.5;
                  color *= vignette;

                  color = pow(color, vec3(1.0 / 2.2));

                  gl_FragColor = vec4(color, 1.0);
                }
              `;
export const AMBER_MESH_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;
export const AMBER_MESH_FRAGMENT_SHADER = `
                precision highp float;
                varying vec2 vUv;
                uniform vec2 u_resolution;
                uniform float u_time;

                float random(vec2 st) {
                  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
                }

                void main() {
                  vec2 uv = vUv;

                  vec2 posA = vec2(0.2, 0.2);
                  vec2 posB = vec2(0.9, 0.3);
                  vec2 posC = vec2(0.4, 0.8);
                  vec2 posD = vec2(0.7, 0.7);
                  vec2 posE = vec2(0.85, 0.15);
                  vec2 posF = vec2(0.35, 0.4);

                  vec2 segmentA = mix(posA, posB, uv.x);
                  vec2 segmentB = mix(posC, posD, uv.x);
                  vec2 segmentC = mix(posE, posF, uv.x);
                  vec2 mainLine = mix(segmentA, segmentB, sin(uv.y * 3.14159 * 0.5 + 0.2) * 0.3 + 0.35);
                  vec2 secondaryLine = mix(segmentC,
                    mix(segmentA, segmentB, uv.y * 0.7),
                    sin(uv.y * 3.14159 * 0.3) * 0.15 + 0.2);

                  float time = u_time * 0.06;
                  vec2 offsetA = vec2(
                    sin(time * 0.8 + 0.5) * 0.12 + cos(time * 0.5) * 0.04,
                    cos(time * 0.6 + 1.2) * 0.1 + sin(time * 0.4) * 0.06
                  ) * (1.0 - uv.y);
                  vec2 offsetB = vec2(
                    cos(time * 0.7 + 1.8) * 0.1 + cos(time * 0.45) * 0.05,
                    sin(time * 0.9 + 2.3) * 0.08 + sin(time * 0.5) * 0.07
                  ) * (1.0 - uv.y);
                  vec2 offsetC = vec2(
                    sin(time * 0.5 + 3.1) * 0.15 + cos(time * 0.7) * 0.08,
                    sin(time * 0.4 + 0.7) * 0.12 + cos(time * 0.6) * 0.04
                  ) * (1.0 - uv.y);

                  vec3 lineColor1 = mix(vec3(0.75, 0.55, 0.2), vec3(0.95, 0.35, 0.0), uv.x);

                  vec2 linePosition = mainLine + offsetA * 0.25 + secondaryLine * 0.1;
                  float distToLine = abs(uv.y - linePosition.y);

                  float lineWidth = 0.008 + 0.005 * sin(time + uv.x * 3.0 + uv.y * 2.0) +
                    0.002 * sin(time * 1.3 + uv.x * 1.5);
                  float coreWidth = lineWidth * 0.35;
                  float proximity = 1.0 - smoothstep(0.0, lineWidth, distToLine);
                  float coreProximity = 1.0 - smoothstep(0.0, coreWidth, distToLine);

                  vec2 screenUV = uv;
                  float gridScale = 18.0;
                  vec2 gridUV = screenUV * gridScale;
                  vec2 gridLine = abs(fract(gridUV) - 0.5);
                  float gridLineThickness = 0.02;
                  float gridX = 1.0 - smoothstep(0.0, gridLineThickness, gridLine.x);
                  float gridY = 1.0 - smoothstep(0.0, gridLineThickness, gridLine.y);
                  float grid = gridX + gridY;

                  vec2 smallGridUV = screenUV * gridScale * 0.3;
                  vec2 smallGridLine = abs(fract(smallGridUV) - 0.5);
                  float smallGridX = 1.0 - smoothstep(0.0, 0.008, smallGridLine.x);
                  float smallGridY = 1.0 - smoothstep(0.0, 0.008, smallGridLine.y);
                  float smallGrid = smallGridX + smallGridY;

                  vec3 bg = vec3(0.03, 0.02, 0.02);
                  vec3 color = bg;

                  float glow = exp(-distToLine * 8.0) * (0.6 + 0.4 * sin(time * 0.5));
                  color += lineColor1 * glow * 0.2;

                  vec3 highlightColor = vec3(1.0, 0.78, 0.25);
                  color = mix(color,
                    highlightColor,
                    coreProximity * (1.0 + 0.5 * sin(time * 2.0 + uv.x * 10.0 + uv.y * 5.0)));
                  color += lineColor1 * coreProximity * 0.5;

                  vec2 branchUV = vec2(
                    uv.x + 0.3 * sin(time + uv.y * 2.0 + 1.0),
                    uv.y + 0.1 * cos(time * 0.8 + uv.x * 3.0 + 2.5)
                  );
                  float branchDist = abs(branchUV.y - (0.5 + 0.15 * sin(branchUV.x * 6.0 + time)));
                  float branchProximity = 1.0 - smoothstep(0.0, 0.012, branchDist);
                  color = mix(color, vec3(1.0, 0.6, 0.1), branchProximity * 0.15);

                  color = mix(color, vec3(0.02, 0.02, 0.03), grid * 0.5);
                  color = mix(color, vec3(0.02, 0.02, 0.03), smallGrid * 0.4);

                  float cornerX = min(uv.x, 1.0 - uv.x) * gridScale;
                  float cornerY = min(uv.y, 1.0 - uv.y) * gridScale;
                  float cornerFactor = 1.0 - smoothstep(0.0, 0.8, min(cornerX, cornerY));
                  color = mix(color, vec3(0.02, 0.02, 0.03), cornerFactor * 0.8);

                  vec3 vignetteColor = vec3(0.02, 0.01, 0.01);
                  float vignetteFactor = 1.0 - length((uv - 0.5) * 1.5);
                  color = mix(color, vignetteColor, vignetteFactor * vignetteFactor * 0.7);
                  color = mix(color, vec3(0.02, 0.02, 0.03), 0.3);

                  color = max(color, vec3(0.0));

                  gl_FragColor = vec4(color, 0.55);
                }
              `;
export const GLASS_SHIMMER_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;
export const GLASS_SHIMMER_FRAGMENT_SHADER = `
                precision highp float;
                varying vec2 vUv;
                uniform vec2 u_resolution;
                uniform float u_time;

                void main() {
                  vec2 uv = vUv * 2.0 - 1.0;
                  vec2 p = uv;
                  float t = u_time * 0.15;
                  float d = length(p);
                  vec3 col = mix(vec3(0.54, 0.64, 0.76), vec3(0.95, 0.97, 1.0), d);
                  float sparkle = 0.0;
                  for (int i = 0; i < 5; i++) {
                    float fi = float(i);
                    float fx = sin(fi * 7.3 + t * 2.0) * 0.2;
                    float fy = cos(fi * 11.1 + t * 1.7) * 0.2;
                    float dd = length(p - vec2(fx, fy));
                    sparkle += smoothstep(0.02, 0.0, dd) * pow(0.5 + 0.5 * sin(t * 3.0 + fi), 2.0);
                  }
                  col += vec3(1.0, 0.98, 0.95) * sparkle * 0.3;
                  col += vec3(0.8, 0.9, 1.0) * smoothstep(0.8, 0.4, d) * 0.1;
                  float vignette = 1.0 - d * d * 0.5;
                  col *= vignette;
                  col = pow(col, vec3(0.9));
                  col = clamp(col, 0.0, 1.0);
                  gl_FragColor = vec4(col, 0.15);
                }
              `;
