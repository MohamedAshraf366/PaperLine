export const EMERALD_HORIZON_VERTEX_SHADER = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                  vUv = position * 0.5 + 0.5;
                  gl_Position = vec4(position, 0.0, 1.0);
                }
              `;
export const EMERALD_HORIZON_FRAGMENT_SHADER = `
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
