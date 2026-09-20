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
                uniform float u_time;
                uniform vec2 u_resolution;
                varying vec2 vUv;

                void main() {
                  vec2 st = gl_FragCoord.xy / u_resolution.xy;
                  vec2 uv = st;
                  float aspect = u_resolution.x / u_resolution.y;
                  uv.x *= aspect;

                  float color1 = sin(uv.x * 3.0 + u_time * 0.8) * 0.5 + 0.5;
                  float color2 = sin(uv.y * 4.0 - u_time * 0.6 + uv.x * 2.0) * 0.5 + 0.5;
                  float color3 = sin((uv.x + uv.y) * 5.0 + u_time * 1.2) * 0.5 + 0.5;

                  float c = (color1 * 0.4 + color2 * 0.3 + color3 * 0.3);

                  vec3 col1 = vec3(0.95, 0.55, 0.15);
                  vec3 col2 = vec3(0.99, 0.80, 0.30);
                  vec3 col = mix(col1, col2, c);

                  float vignette = 1.0 - length(st - vec2(0.5)) * 0.6;
                  col *= vignette;

                  gl_FragColor = vec4(col, 0.55);
                }
              `;
