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
