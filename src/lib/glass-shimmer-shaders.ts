export const GLASS_SHIMMER_VERTEX_SHADER = `
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = vec4(position, 1.0);
                }
              `;

export const GLASS_SHIMMER_FRAGMENT_SHADER = `
              precision highp float;
              uniform float u_time;
              uniform vec2 u_resolution;
              varying vec2 vUv;

              void main() {
                vec2 st = gl_FragCoord.xy / u_resolution.xy;

                float shimmer = sin(st.x * 12.0 + u_time * 2.0) * 0.5 + 0.5;
                shimmer *= sin(st.y * 15.0 - u_time * 1.5) * 0.5 + 0.5;
                shimmer *= 0.3;

                vec3 col = vec3(1.0, 1.0, 1.0) * shimmer;

                float alpha = shimmer * 0.15;

                gl_FragColor = vec4(col, alpha);
              }
            `;
