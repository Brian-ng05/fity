"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Center, ContactShadows, Html, Line, OrbitControls } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";

export type Section = {key:string;label:string;target_cm:number;model_cm:number;fit_error_cm:number;points_m:[number,number,number][]};

function Surface({ object, wireframe, targetHeight }: { object: THREE.Object3D; wireframe: boolean; targetHeight: number }) {
  const model = useMemo(() => {
    const copy = object.clone(true);
    copy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: "#96ab94",
          roughness: 0.68,
          metalness: 0.08,
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
  }, [object, targetHeight]);

  useEffect(() => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.wireframe = wireframe;
        child.material.needsUpdate = true;
      }
    });
  }, [model, wireframe]);

  useEffect(() => () => model.traverse((child) => {
    if (child instanceof THREE.Mesh) (child.material as THREE.Material).dispose();
  }), [model]);

  return <Center top position={[0, 0.025, 0]}><primitive object={model} /></Center>;
}

function Sample({ wireframe }: { wireframe: boolean }) {
  const object = useLoader(OBJLoader, "/sample-body.obj");
  return <Surface object={object} wireframe={wireframe} targetHeight={1.75} />;
}

function Result({ url, wireframe, targetHeightCm }: { url: string; wireframe: boolean; targetHeightCm?: number }) {
  const model = useLoader(GLTFLoader, url);
  return <Surface object={model.scene} wireframe={wireframe} targetHeight={1.75} />;
}

function MeasurementRings({ heightCm, sections }: { heightCm:number; sections:Section[] }) {
  const scale=1.75/(heightCm/100);
  return <group position={[0,.025,0]}>{sections.map(section=>{
    const points=section.points_m.map(p=>[p[0]*scale,p[1]*scale,p[2]*scale] as [number,number,number]);
    if(points.length<3)return null;
    const right=points.reduce((a,b)=>b[0]>a[0]?b:a);
    return <group key={section.key}><Line points={points} color="#17694c" lineWidth={2}/><Html position={[right[0]+.05,right[1],right[2]]} center style={{pointerEvents:"none"}}><div className="ring-3d-tag">{section.label} · avatar {section.model_cm} cm</div></Html></group>;
  })}</group>;
}

function Controls({ reset, autoRotate }: { reset: number; autoRotate: boolean }) {
  const controls = useRef<OrbitControlsType>(null);
  const camera = useThree(state => state.camera);
  useEffect(() => {
    camera.position.set(0, 0.95, 3.1);
    if (controls.current) {
      controls.current.target.set(0, 0.88, 0);
      controls.current.update();
    }
  }, [reset, camera]);
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


  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.95, 3.1], fov: 42 }} gl={{ antialias: true, alpha: true }} fallback={<p className="viewer-fallback">Trình duyệt chưa hỗ trợ WebGL. Hãy bật tăng tốc đồ họa hoặc mở bằng Chrome.</p>}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 5, 4]} intensity={2.6} />
      <directionalLight position={[-3, 2, -2]} intensity={1.8} color="#eaf6df" />
      <Suspense fallback={null}>
        {url ? <Result url={url} wireframe={wireframe} targetHeightCm={targetHeightCm} /> : <Sample wireframe={wireframe} />}
      </Suspense>
      {url && showRings && sections && targetHeightCm && <MeasurementRings heightCm={targetHeightCm} sections={sections}/> }
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={2} blur={1.2} far={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}><ringGeometry args={[0.60, 0.605, 96]} /><meshBasicMaterial color="#bcc9bd" side={THREE.DoubleSide} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.61, 96]} /><meshBasicMaterial color="#ccd7cb" transparent opacity={0.45} /></mesh>
      <Controls reset={reset} autoRotate={autoRotate} />
    </Canvas>
  );
}
