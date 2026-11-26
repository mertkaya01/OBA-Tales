/**
 * Geliş sinemasının 3D parçası: Kut Kapısı'ndan kavisle süzülen ışık küresi, arkasında kıvılcım izi, indiği yerde
 * gökyüzüne uzanan ışık sütunu ve yerde yayılan halka. Zamanlamayı arrival.ts verir; sinema (DOM) runtime'ı yazar.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Matrix4, MeshBasicMaterial, Quaternion, RingGeometry, Vector3, type InstancedMesh, type Mesh } from "three";
import { arrivalAt, orbPath, type ArrivalRuntime } from "./arrival";

const TRAIL = 18;

export function ArrivalEffect({ runtime }: { runtime: ArrivalRuntime }) {
  const groupRef = useRef<Group>(null);
  const orbRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const trailRef = useRef<InstancedMesh>(null);
  const columnRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  const assets = useMemo(
    () => ({
      orbGeo: new IcosahedronGeometry(1.6, 1),
      haloGeo: new IcosahedronGeometry(4.2, 1),
      sparkGeo: new IcosahedronGeometry(0.55, 0),
      columnGeo: new CylinderGeometry(3.2, 4.6, 70, 12, 1, true).translate(0, 35, 0),
      ringGeo: new RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2),
      orb: new MeshBasicMaterial({ color: "#fff4c2", transparent: true, blending: AdditiveBlending, depthWrite: false }),
      halo: new MeshBasicMaterial({ color: "#9fe8ff", transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }),
      spark: new MeshBasicMaterial({ color: "#ffe08a", transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
      column: new MeshBasicMaterial({ color: "#bff3ff", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      ring: new MeshBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const value of Object.values(assets)) value.dispose();
    },
    [assets],
  );

  const work = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3() }), []);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.visible = runtime.active;
    if (!runtime.active) return;
    const frame = arrivalAt(runtime.t);
    const pulse = 1 + Math.sin(clock.elapsedTime * 14) * 0.12;

    // Küre ve izi
    const flying = frame.orb !== null;
    if (orbRef.current && haloRef.current) {
      orbRef.current.visible = flying;
      haloRef.current.visible = flying;
      if (flying) {
        const [x, y, z] = orbPath(runtime.from, runtime.to, frame.orb!);
        orbRef.current.position.set(x, y, z);
        orbRef.current.scale.setScalar(pulse);
        haloRef.current.position.set(x, y, z);
        haloRef.current.scale.setScalar(pulse * 1.1);
      }
    }
    const trail = trailRef.current;
    if (trail) {
      trail.visible = flying;
      if (flying) {
        for (let i = 0; i < TRAIL; i++) {
          const k = Math.max(0, frame.orb! - (i + 1) * 0.018);
          const [x, y, z] = orbPath(runtime.from, runtime.to, k);
          const size = (1 - i / TRAIL) * 1.2;
          work.p.set(x + Math.sin(i * 2.3 + clock.elapsedTime * 6) * 0.6, y, z + Math.cos(i * 1.7 + clock.elapsedTime * 5) * 0.6);
          trail.setMatrixAt(i, work.m.compose(work.p, work.q, work.s.setScalar(size)));
        }
        trail.instanceMatrix.needsUpdate = true;
      }
    }

    // Varış: ışık sütunu ve yayılan halka
    const { to } = runtime;
    if (columnRef.current) {
      columnRef.current.position.set(to.x, to.y - 1.5, to.z);
      columnRef.current.scale.set(0.6 + frame.column * 0.6, 1, 0.6 + frame.column * 0.6);
      assets.column.opacity = frame.column * 0.55;
      columnRef.current.visible = frame.column > 0;
    }
    if (ringRef.current) {
      const spread = 1 - frame.column;
      ringRef.current.position.set(to.x, to.y - 1.2, to.z);
      ringRef.current.scale.setScalar(4 + spread * 30);
      assets.ring.opacity = frame.column * 0.8;
      ringRef.current.visible = frame.column > 0;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={orbRef} geometry={assets.orbGeo} material={assets.orb} />
      <mesh ref={haloRef} geometry={assets.haloGeo} material={assets.halo} />
      <instancedMesh ref={trailRef} args={[assets.sparkGeo, assets.spark, TRAIL]} frustumCulled={false} />
      <mesh ref={columnRef} geometry={assets.columnGeo} material={assets.column} />
      <mesh ref={ringRef} geometry={assets.ringGeo} material={assets.ring} />
    </group>
  );
}
