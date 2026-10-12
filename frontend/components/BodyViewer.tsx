"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Center, ContactShadows, Line, OrbitControls } from "@react-three/drei";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";

export type Section = {key:string;label:string;target_cm:number;model_cm:number;fit_error_cm:number;points_m:[number,number,number][]};
const SECTION_COLORS: Record<string,string> = {chest_cm:"#17694c",waist_cm:"#995423",hip_cm:"#365b88",chest:"#17694c",waist:"#995423",hip:"#365b88"};
const VIEWS = [{label:"Trước",angle:0},{label:"Nghiêng",angle:Math.PI/2},{label:"Sau",angle:Math.PI},{label:"3/4",angle:Math.PI/4}];

function Surface({ object, wireframe, targetHeight, preserveOrigin = false }: { object: THREE.Object3D; wireframe: boolean; targetHeight: number; preserveOrigin?: boolean }) {
  const model = useMemo(() => {
    const copy = object.clone(true);
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Own the geometry; never mutate the shared loader cache.
        let geometry=child.geometry.clone();
        if(!preserveOrigin){
          geometry.deleteAttribute("normal");geometry.deleteAttribute("uv");
          const welded=mergeVertices(geometry);geometry.dispose();geometry=welded;
          geometry.computeVertexNormals();
        }
        child.geometry=geometry;
        child.material = new THREE.MeshStandardMaterial({
          color: "#a5b5a3",
          roughness: 0.82,
          metalness: 0.02,
          wireframe,
          side: THREE.DoubleSide,
        });
        child.castShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(copy);
    const sizeY = box.getSize(new THREE.Vector3()).y;
    if (sizeY > 0) {
      copy.scale.setScalar(targetHeight / sizeY);
    }
    return copy;
  }, [object, targetHeight, preserveOrigin]);

  useEffect(() => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.wireframe = wireframe;
        child.material.needsUpdate = true;
      }
    });
  }, [model, wireframe]);

  useEffect(() => () => model.traverse((child) => {
    if (child instanceof THREE.Mesh) { (child.material as THREE.Material).dispose();child.geometry.dispose(); }
  }), [model]);

  return preserveOrigin ? <group position={[0, 0.025, 0]}><primitive object={model}/></group> : <Center top position={[0, 0.025, 0]}><primitive object={model} /></Center>;
}

function Sample({ wireframe }: { wireframe: boolean }) {
  const object = useLoader(OBJLoader, "/sample-body.obj");
  return <Surface object={object} wireframe={wireframe} targetHeight={1.75} />;
}

function Result({ url, wireframe }: { url: string; wireframe: boolean }) {
  const model = useLoader(GLTFLoader, url);
  return <Surface object={model.scene} wireframe={wireframe} targetHeight={1.75} preserveOrigin />;
}

function MeasurementRings({ heightCm, sections }: { heightCm:number; sections:Section[] }) {
  const scale=1.75/(heightCm/100);
  return <group position={[0,.025,0]}>{sections.map(section=>{
    const points=section.points_m.map(p=>[p[0]*scale,p[1]*scale,p[2]*scale] as [number,number,number]);
    if(points.length<3)return null;
    return <Line key={section.key} points={points} color={SECTION_COLORS[section.key]||"#17694c"} lineWidth={2.5} />;
  })}</group>;
}

function Controls({ reset, autoRotate, angle, revision }: { reset: number; autoRotate: boolean; angle:number; revision:number }) {
  const controls = useRef<OrbitControlsType>(null);
  const camera = useThree(state => state.camera);
  useEffect(() => {
    camera.position.set(Math.sin(angle)*3.1, 0.95, Math.cos(angle)*3.1);
    if (controls.current) {
      controls.current.target.set(0, 0.88, 0);
      controls.current.update();
    }
  }, [reset, camera, angle, revision]);
  return <OrbitControls ref={controls} target={[0, 0.88, 0]} enablePan={false} minDistance={1.8} maxDistance={5} maxPolarAngle={Math.PI / 1.85} minPolarAngle={0.2} autoRotate={autoRotate} autoRotateSpeed={0.65} />;
}

export default function BodyViewer({
  url,
  wireframe,
  reset,
  autoRotate,
  targetHeightCm,
  showRings,
  sections,
}: {
  url?: string;
  wireframe: boolean;
  reset: number;
  autoRotate: boolean;
  targetHeightCm?: number;
  showRings?: boolean;
  sections?: Section[];
}) {
  const [view,setView]=useState(0),[revision,setRevision]=useState(0),[paused,setPaused]=useState(false);
  useEffect(()=>{setPaused(false);},[autoRotate]);
  useEffect(()=>{setView(0);},[reset]);
  return (
    <div className="body-viewer">
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.95, 3.1], fov: 42 }} gl={{ antialias: true, alpha: true }} fallback={<p className="viewer-fallback">Trình duyệt chưa hỗ trợ WebGL. Hãy bật tăng tốc đồ họa hoặc mở bằng Chrome.</p>}>
      <hemisphereLight args={["#fffdf5","#697d6c",1.8]} />
      <directionalLight position={[-3, 4, 5]} intensity={2.2} />
      <directionalLight position={[3, 2, -3]} intensity={1.6} color="#f2f6ed" />
      <Suspense fallback={null}>
        {url ? <Result url={url} wireframe={wireframe} /> : <Sample wireframe={wireframe} />}
      </Suspense>
      {url && showRings && sections && targetHeightCm && <MeasurementRings heightCm={targetHeightCm} sections={sections}/> }
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={2} blur={1.2} far={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}><ringGeometry args={[0.60, 0.605, 96]} /><meshBasicMaterial color="#bcc9bd" side={THREE.DoubleSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.61, 96]} /><meshBasicMaterial color="#ccd7cb" transparent opacity={0.45} /></mesh>
      <Controls reset={reset} autoRotate={autoRotate&&!paused} angle={VIEWS[view].angle} revision={revision} />
    </Canvas>
    {url&&showRings&&sections&&<div className="body-legend" aria-label="Chu vi trên avatar"><span>Vòng đo trên avatar</span>{sections.map(s=><div key={s.key}><i style={{background:SECTION_COLORS[s.key]||"#17694c"}}/><span>{s.label}</span><strong>{s.model_cm} <small>cm</small></strong></div>)}</div>}
    <div className="body-view-presets" aria-label="Góc xem cơ thể">{VIEWS.map((v,i)=><button key={v.label} onClick={()=>{setView(i);setRevision(n=>n+1);setPaused(true);}} aria-label={`Xem ${v.label.toLowerCase()}`} title={`Xem ${v.label.toLowerCase()} · dừng tự xoay`}>{v.label}</button>)}</div>
    </div>
  );
}
