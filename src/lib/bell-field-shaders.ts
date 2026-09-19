export const BELL_FIELD_VERTEX_SHADER = `
                attribute vec2 position;
                void main() { gl_Position = vec4(position, 0.0, 1.0); }
            `;

export const BELL_FIELD_FRAGMENT_SHADER = `
                precision highp float;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform vec2 u_mouse;
                uniform float u_strike;

                #define PI 3.14159265359

                float hash(vec2 p) { return fract(sin(dot(p, vec2(23.71, 91.37))) * 41537.1234); }

                float bess(float x) { return cos(x - 0.785398) / sqrt(1.0 + abs(x)); }

                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                    vec2 p = uv * 2.0 - 1.0;
                    p.x *= u_resolution.x / u_resolution.y;
                    p.y += 0.08;

                    vec2 m = u_mouse / u_resolution.xy * 2.0 - 1.0;
                    m.y = -m.y;
                    m.x *= u_resolution.x / u_resolution.y;
                    p -= m * 0.11;

                    float t = u_time * 0.09;
                    float r = length(p);
                    float a = atan(p.y, p.x);

                    float ang = 3.0 + 1.6 * sin(t * 0.37) + sin(t * 0.19 + 1.7);
                    float k   = 3.1 + 1.0 * sin(t * 0.23 + 0.6);

                    float amp = 1.0 + (1.0 - u_strike) * 0.55;
                    float f1 = bess(r * k * PI - t * 2.2) * cos(ang * a + t * 0.5);
                    float f2 = bess(r * k * 1.6 * PI + t * 1.4) * cos((ang * 2.0 + 1.0) * a - t * 0.31);
                    float f = (f1 + f2 * 0.30) * amp;

                    float node = 1.0 - smoothstep(0.0, 0.075 + 0.075 * r, abs(f));
                    float anti = smoothstep(0.40, 0.95, abs(f));

                    float open = smoothstep(0.14, 0.92, r);
                    node *= open;
                    anti *= open;

                    vec3 deep   = vec3(0.031, 0.055, 0.051);
                    vec3 patina = vec3(0.306, 0.608, 0.541);
                    vec3 bronze = vec3(0.847, 0.608, 0.247);
                    vec3 ash    = vec3(0.937, 0.914, 0.863);

                    vec3 col = deep;
                    col = mix(col, patina, node * 0.50);
                    col = mix(col, bronze, anti * 0.22);
                    col += ash * pow(node, 3.0) * 0.13;

                    float ring = smoothstep(0.06, 0.0, abs(r - u_strike * 2.3)) * (1.0 - u_strike);
                    col += mix(bronze, ash, 0.4) * ring * 0.7;

                    col *= mix(0.10, 1.0, smoothstep(2.0, 0.28, r));
                    col += (hash(gl_FragCoord.xy) - 0.5) * 0.022;

                    gl_FragColor = vec4(col, 1.0);
                }
            `;

export const NXA_ENERGY_ORB_VERTEX_SHADER = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

export const NXA_ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER = `
                precision highp float;
                uniform float uT;uniform vec2 uR;
                uniform float uHue;uniform float uSaturation;uniform float uGlow;
                float hash(vec3 p){p=fract(p*0.3183099+vec3(0.1,0.2,0.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
                float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
                 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
                float fbm(vec3 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec3(1.7);a*=0.5;}return v;}
                vec3 gradeColor(vec3 color){
                  float luminance=dot(color,vec3(0.2126,0.7152,0.0722));
                  color=mix(vec3(luminance),color,uSaturation);
                  vec3 axis=normalize(vec3(1.0));
                  return max(vec3(0.0),color*cos(uHue)+cross(axis,color)*sin(uHue)+axis*dot(axis,color)*(1.0-cos(uHue)));
                }
                void main(){
                  vec2 uv=(gl_FragCoord.xy-0.5*uR)/min(uR.x,uR.y);
                  float r=length(uv);
                  float R=0.31;
                  vec3 col=vec3(0.0);float alpha=0.0;
                  if(r<R){
                    float z=sqrt(R*R-r*r);
                    vec3 n=normalize(vec3(uv,z));
                    float ca=uT*0.15;
                    mat3 rot=mat3(cos(ca),0.,sin(ca),0.,1.,0.,-sin(ca),0.,cos(ca));
                    vec3 sp=rot*n;
                    float f1=fbm(sp*2.6+vec3(0.0,uT*0.12,0.0));
                    float f2=fbm(sp*4.5-vec3(uT*0.08,0.0,uT*0.05)+f1*1.8);
                    float veil=smoothstep(0.35,0.75,f2);
                    vec3 deep=vec3(0.04,0.02,0.12);
                    vec3 mid=vec3(0.22,0.16,0.55);
                    vec3 bright=vec3(0.62,0.60,0.98);
                    col=mix(deep,mid,f1*1.2);
                    col=mix(col,bright,veil*0.65);
                    float fres=pow(1.0-z/R,2.2);
                    col+=vec3(0.55,0.55,1.0)*fres*1.1*uGlow;
                    float top=pow(max(dot(n,normalize(vec3(0.0,0.7,0.7))),0.0),3.0);
                    col+=vec3(0.45,0.42,0.9)*top*0.35*uGlow;
                    alpha=1.0;
                  }
                  float glow=exp(-(r-R)*14.0);
                  if(r>=R){
                    glow=clamp(glow,0.0,1.0);
                    col=vec3(0.55,0.52,1.0)*glow*0.8*uGlow;
                    alpha=glow*0.85;
                  } else {
                    float rim=smoothstep(R-0.03,R,r);
                    col+=vec3(0.6,0.58,1.0)*rim*0.6*uGlow;
                  }
                  col=gradeColor(col);
                  gl_FragColor=vec4(col,alpha);
                }
              `;
