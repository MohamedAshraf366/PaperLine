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

export const EMERALD_HORIZON_VERTEX_SHADER = BELL_FIELD_VERTEX_SHADER;
export const EMERALD_HORIZON_FRAGMENT_SHADER = BELL_FIELD_FRAGMENT_SHADER;
export const ENERGY_ORB_VERTEX_SHADER = BELL_FIELD_VERTEX_SHADER;
export const ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER = BELL_FIELD_FRAGMENT_SHADER;
