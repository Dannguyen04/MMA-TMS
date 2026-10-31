import * as THREE from "three";

import { PAINT } from "./regions";

/**
 * Bản port logic v6 đã duyệt (3d-research/view7b.html):
 * - pre: lượt ghi chiều sâu (không ghi màu)
 * - body: thân hologram, fresnel, độ đặc 0.18, tắt viền ở mặt
 * - paint (occluded): phần bị che, GreaterDepth, 20%, không viền
 * - paint (visible): phần thấy, LessEqualDepth
 * Khoảng cách geodesic 8-bit trong _geo0–3 (kênh slot/ch theo regions json), max blending, mặt nạ bẹn.
 */
export function makePrePass(): THREE.Material {
  return new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
}

export function makeBody(face: readonly number[], light: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    uniforms: {
      uF: { value: new THREE.Vector4(face[0], face[1], face[2], face[3]) },
      uZc: { value: face[4] },
      uTint: { value: light ? new THREE.Color(0.2, 0.3, 0.45) : new THREE.Color(0.55, 0.7, 0.88) },
      uBase: { value: PAINT.bodyOpacity },
    },
    vertexShader: `varying vec3 vN;varying vec3 vV;varying vec3 vW;
void main(){vec3 wn=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vV=-mv.xyz;vN=(viewMatrix*vec4(wn,0.)).xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec4 uF;uniform float uZc;uniform vec3 uTint;uniform float uBase;varying vec3 vN;varying vec3 vV;varying vec3 vW;
void main(){vec3 nn=normalize(vN);float f=pow(1.-clamp(abs(dot(nn,normalize(vV))),0.,1.),2.6);
float inFace=(1.-smoothstep(uF.w*.85,uF.w,distance(vW,uF.xyz)))*smoothstep(uZc-.0015,uZc+.0015,vW.z);f*=1.-inFace;
gl_FragColor=vec4(uTint*(.55+1.7*f),uBase+0.6*f);}`,
  });
}

export type PaintInput = {
  /** Tên vùng theo thứ tự slot*4+ch (SPINE phải là phần tử cuối). */
  names: string[];
  on: number[];
  R: number[];
  core: number[];
  colors: THREE.Color[];
  spine: { y0: number; y1: number; end: number };
  maskIndex: number;
};

export function makePaint(p: PaintInput, occluded: boolean): THREE.ShaderMaterial {
  const NR = p.names.length;
  const mc = p.maskIndex;
  const maskExpr = `${["vA", "vB", "vC", "vD"][mc >> 2]}.${"xyzw"[mc & 3]}`;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    depthFunc: occluded ? THREE.GreaterDepth : THREE.LessEqualDepth,
    side: THREE.DoubleSide,
    uniforms: {
      uOn: { value: p.on },
      uR: { value: p.R },
      uC: { value: p.colors },
      uCore: { value: p.core },
      uPk: { value: PAINT.peak },
      uEm: { value: PAINT.emissive },
      uOcc: { value: occluded ? PAINT.occluded : 1 },
      uSp: { value: new THREE.Vector3(p.spine.y0, p.spine.y1, p.spine.end) },
    },
    vertexShader: `attribute vec4 _geo0;attribute vec4 _geo1;attribute vec4 _geo2;attribute vec4 _geo3;varying vec4 vA;varying vec4 vB;varying vec4 vC;varying vec4 vD;varying float vY;
void main(){vA=_geo0;vB=_geo1;vC=_geo2;vD=_geo3;vec4 w=modelMatrix*vec4(position,1.);vY=w.y;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `#define NR ${NR}
uniform float uOn[NR];uniform float uR[NR];uniform vec3 uC[NR];uniform float uCore[NR];uniform float uPk,uEm,uOcc;uniform vec3 uSp;
varying vec4 vA;varying vec4 vB;varying vec4 vC;varying vec4 vD;varying float vY;
float dist(int i){vec4 p=i<4?vA:(i<8?vB:(i<12?vC:vD));int c=i-4*(i/4);return c==0?p.x:(c==1?p.y:(c==2?p.z:p.w));}
void main(){float A=0.;vec3 col=vec3(0.);
for(int i=0;i<NR;i++){if(uOn[i]<.5)continue;float R=uR[i];
if(i==NR-1){float e=min(uSp.x-vY,vY-uSp.y);if(e<-uSp.z*.25)continue;float tp=smoothstep(-uSp.z*.25,uSp.z,e);R*=mix(.25,1.,tp);}
float w=1.-smoothstep(uCore[i]*R,R,dist(i));if(w>A){A=w;col=uC[i];}}
A*=1.-${maskExpr};float al=A*uPk*uOcc;if(al<.003)discard;gl_FragColor=vec4(min(col*(1.+uEm),vec3(1.)),al);}`,
  });
}
