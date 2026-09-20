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
