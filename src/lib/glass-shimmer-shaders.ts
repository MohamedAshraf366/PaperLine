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
