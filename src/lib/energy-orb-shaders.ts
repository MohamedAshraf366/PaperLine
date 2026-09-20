export const ENERGY_ORB_VERTEX_SHADER = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

export const ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER = `
                precision highp float;
                uniform float u_time;uniform vec2 u_resolution;
                uniform float u_hue;uniform float u_sat;uniform float u_brightness;uniform float u_opacity;uniform float u_scale;uniform float uGlow;
                float hash(vec3 p){p=fract(p*0.3183099+vec3(0.1,0.2,0.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
                float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
                 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
                float fbm(vec3 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec3(1.7);a*=0.5;}return v;}
                vec3 gradeColor(vec3 color){
                  float luminance=dot(color,vec3(0.2126,0.7152,0.0722));
                  color=mix(vec3(luminance),color,u_sat);
                  vec3 axis=normalize(vec3(1.0));
                  return max(vec3(0.0),color*cos(u_hue)+cross(axis,color)*sin(u_hue)+axis*dot(axis,color)*(1.0-cos(u_hue)));
                }
                void main(){
                  vec2 uv=(gl_FragCoord.xy-0.5*u_resolution)/min(u_resolution.x,u_resolution.y);
                  float r=length(uv);
                  float R=0.31*u_scale;
                  vec3 col=vec3(0.0);float alpha=0.0;
                  if(r<R){
                    float z=sqrt(R*R-r*r);
                    vec3 n=normalize(vec3(uv,z));
                    float ca=u_time*0.15;
                    mat3 rot=mat3(cos(ca),0.,sin(ca),0.,1.,0.,-sin(ca),0.,cos(ca));
                    vec3 sp=rot*n;
                    float f1=fbm(sp*2.6+vec3(0.0,u_time*0.12,0.0));
                    float f2=fbm(sp*4.5-vec3(u_time*0.08,0.0,u_time*0.05)+f1*1.8);
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
                  col *= u_brightness;
                  gl_FragColor=vec4(col,alpha*u_opacity);
                }
              `;
