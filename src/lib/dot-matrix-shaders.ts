export const CORE_UPLINK_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;
export const CORE_UPLINK_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uGridScale;
uniform float uMouseAmount;
uniform float uPulseSpeed;
uniform float uRadius;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;
  uv += uMouse * uMouseAmount;
  vec2 grid = fract(uv * uGridScale);
  vec2 id = floor(uv * uGridScale);
  float dist = length(grid - vec2(0.5));
  float pulse = sin(uTime * uPulseSpeed + id.x * 0.05 + id.y * 0.05) * 0.5 + 0.5;
  float point = smoothstep(0.5, 0.0, dist);
  float center = smoothstep(uRadius, 0.0, length(id - vec2(0.0)) * 0.1);
  float line = smoothstep(0.5, 0.47, dist) * (1.0 - smoothstep(0.5, 0.48, dist));
  vec3 color = mix(vec3(0.07, 0.08, 0.1), vec3(0.0, 0.0, 0.0), length(grid));
  vec3 gridColor = vec3(0.05, 0.04, 0.1) * pulse;
  color = mix(color, gridColor, line);
  color += vec3(0.02, 0.02, 0.04) * point;
  color *= uOpacity;
  gl_FragColor = vec4(color, 1.0);
}
`;
