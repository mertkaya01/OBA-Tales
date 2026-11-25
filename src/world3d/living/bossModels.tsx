/**
 * BOSS MODELLERİ (Bölüm 6, 9, 12) — kodla, basit geometrik parçalardan; karakterler gibi sis ekini almaz.
 *
 *   Sisçi Karaçay   pusların kurnaz gölge gemisi: dumandan yırtık yelkenler, lomboz gözler; havada süzülür
 *   Ayazkurt        gümüş tüylü fırtına: oturan kocaman kurt, buz mavisi gözler, çevresinde dönen buz kristalleri
 *   Kışgölgesi Han  Günözü'nün kadim muhafızı: taç, uzun pelerin, gölgede iki altın göz, asada soluk Günözü Taşı
 *
 * Hepsi yüzünü yerel +z'ye (akıncılara) döner; ayakları (ya da gölgesi) (0, 0, 0)'da.
 * Buzkıran Tekgöz RaidGround.tsx içinde.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { DoubleSide, MeshBasicMaterial, MeshLambertMaterial, type Group, type Mesh } from "three";

type Materials = Record<string, { dispose: () => void }>;

/** Malzemeler bir kez kurulur (useState'in tembel başlangıcı), bileşen kalkınca serbest bırakılır. */
function useDisposable<T extends Materials>(factory: () => T): T {
  const [materials] = useState(factory);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  return materials;
}

// ── Sisçi Karaçay ──────────────────────────────────────────────────

export function Karacay({ animate }: { animate: boolean }) {
  const floatRef = useRef<Group>(null);
  const sailsRef = useRef<Group>(null);
  const fogRef = useRef<Group>(null);
  const flagRef = useRef<Mesh>(null);

  const m = useDisposable(() => ({
    hull: new MeshLambertMaterial({ color: "#3d3450", flatShading: true }),
    keel: new MeshLambertMaterial({ color: "#2b2438", flatShading: true }),
    trim: new MeshLambertMaterial({ color: "#5a4f7a", flatShading: true }),
    mast: new MeshLambertMaterial({ color: "#3b2a1e", flatShading: true }),
    // Dumandan yelken: karlı zeminde seçilsin diye koyu is rengi
    sail: new MeshLambertMaterial({ color: "#5d5876", transparent: true, opacity: 0.88, side: DoubleSide, flatShading: true }),
    flag: new MeshLambertMaterial({ color: "#4a4060", side: DoubleSide }),
    eye: new MeshBasicMaterial({ color: "#f6d36f" }),
    fog: new MeshLambertMaterial({ color: "#c9c3dd", transparent: true, opacity: 0.42, depthWrite: false, flatShading: true }),
  }));

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    if (floatRef.current) {
      floatRef.current.position.y = 8 + Math.sin(t * 0.8) * 0.9;
      floatRef.current.rotation.z = Math.sin(t * 0.55) * 0.045;
      floatRef.current.rotation.x = Math.sin(t * 0.7 + 1) * 0.025;
    }
    // Yelkenler rüzgârda şişip iner, flama dalgalanır, sis yatağı döner, lomboz gözler kısılıp açılır.
    if (sailsRef.current) sailsRef.current.scale.z = 1 + Math.sin(t * 1.7) * 0.6;
    if (flagRef.current) flagRef.current.rotation.y = Math.sin(t * 3) * 0.4;
    if (fogRef.current) fogRef.current.rotation.y = t * 0.15;
    const blink = Math.sin(t * 1.3) * 0.5 + 0.5;
    m.eye.color.setRGB(0.96, 0.7 + blink * 0.13, 0.3 + blink * 0.14);
  });

  /** Yırtık yelken: aralarında boşluk kalan üç şerit. */
  const sail = (x: number, y: number, width: number, height: number) =>
    [0, 1, 2].map((k) => (
      <mesh key={k} material={m.sail} position={[x + (k === 1 ? 0.4 : 0), y + height / 2 - (k + 0.5) * (height / 3), 0.1]} castShadow>
        <boxGeometry args={[width - k * 0.8, height / 3 - 0.5, 0.25]} />
      </mesh>
    ));

  return (
    <group>
      {/* Sis yatağı */}
      <group ref={fogRef} position-y={3}>
        {[0, 1, 2, 3, 4, 5, 6].map((k) => {
          const a = (k / 7) * Math.PI * 2;
          return (
            <mesh key={k} material={m.fog} position={[Math.cos(a) * 11, (k % 3) * 0.8, Math.sin(a) * 6]} scale={[1.4, 0.7, 1]}>
              <icosahedronGeometry args={[3 + (k % 3), 0]} />
            </mesh>
          );
        })}
      </group>

      <group ref={floatRef} position-y={8}>
        {/* Gövde: uzun yanı akıncılara dönük (borda) */}
        <mesh material={m.keel} castShadow>
          <boxGeometry args={[20, 3, 6]} />
        </mesh>
        <mesh material={m.hull} position-y={2.6} castShadow>
          <boxGeometry args={[25, 4, 8]} />
        </mesh>
        <mesh material={m.hull} position={[14.5, 2.6, 0]} rotation-z={-Math.PI / 2} castShadow>
          <coneGeometry args={[4, 6, 4]} />
        </mesh>
        <mesh material={m.trim} position-y={4.85} castShadow>
          <boxGeometry args={[25.4, 0.6, 8.4]} />
        </mesh>
        <mesh material={m.hull} position={[-10.5, 6.8, 0]} castShadow>
          <boxGeometry args={[5.5, 4, 8]} />
        </mesh>
        <mesh material={m.mast} position={[17.5, 4.5, 0]} rotation-z={-1.1}>
          <cylinderGeometry args={[0.25, 0.3, 7, 5]} />
        </mesh>
        {/* Lomboz gözler ve kıç feneri */}
        {[-6, -1.5, 3, 7.5].map((x) => (
          <mesh key={x} material={m.eye} position={[x, 2.6, 4.06]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.8, 0.8, 0.2, 8]} />
          </mesh>
        ))}
        <mesh material={m.eye} position={[-10.5, 7.2, 4.06]}>
          <boxGeometry args={[1.4, 1.4, 0.2]} />
        </mesh>
        {/* Direkler ve dumandan yelkenler */}
        <mesh material={m.mast} position={[-1, 14, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.5, 19, 6]} />
        </mesh>
        <mesh material={m.mast} position={[8, 12, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.45, 15, 6]} />
        </mesh>
        <group ref={sailsRef}>
          {sail(-1, 15, 10, 11)}
          {sail(8, 12.5, 7.5, 8.5)}
        </group>
        <mesh ref={flagRef} material={m.flag} position={[0.8, 23.5, 0]}>
          <boxGeometry args={[3.2, 1.6, 0.1]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Ayazkurt ───────────────────────────────────────────────────────

export function Ayazkurt({ animate }: { animate: boolean }) {
  const headRef = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const chestRef = useRef<Mesh>(null);
  const earsRef = useRef<Group>(null);
  const stormRef = useRef<Group>(null);

  const m = useDisposable(() => ({
    fur: new MeshLambertMaterial({ color: "#c3ced9", flatShading: true }),
    dark: new MeshLambertMaterial({ color: "#7f8c9a", flatShading: true }),
    white: new MeshLambertMaterial({ color: "#eef3f8", flatShading: true }),
    nose: new MeshLambertMaterial({ color: "#2a2b33", flatShading: true }),
    eye: new MeshBasicMaterial({ color: "#9fe0ff" }),
    crystal: new MeshBasicMaterial({ color: "#dff6ff" }),
  }));

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(t * 1.4) * 0.45;
    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(t * 0.5) * 0.08;
      headRef.current.rotation.x = Math.sin(t * 0.7) * 0.05;
    }
    if (chestRef.current) chestRef.current.scale.y = 1.3 * (1 + Math.sin(t * 1.6) * 0.025);
    // Arada bir kulak seğirmesi
    if (earsRef.current) earsRef.current.rotation.z = t % 5 < 0.25 ? Math.sin(t * 40) * 0.12 : 0;
    if (stormRef.current) stormRef.current.rotation.y = t * 0.6;
  });

  return (
    // "Kocaman bir fırtına canavarı": akıncıların yanında iri dursun.
    <group scale={1.35}>
      {/* Arka gövde ve katlanmış arka bacaklar */}
      <mesh material={m.fur} position={[0, 7, -3]} scale={[1, 0.9, 1.2]} castShadow>
        <icosahedronGeometry args={[7, 0]} />
      </mesh>
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} material={m.dark} position={[x, 3, -1.5]} castShadow>
          <icosahedronGeometry args={[3.2, 0]} />
        </mesh>
      ))}
      {/* Göğüs tüyü */}
      <mesh ref={chestRef} material={m.white} position={[0, 10, 2]} scale={[1, 1.3, 0.9]} castShadow>
        <icosahedronGeometry args={[5, 0]} />
      </mesh>
      {/* Ön bacaklar ve patiler */}
      {[-2.6, 2.6].map((x) => (
        <group key={x}>
          <mesh material={m.fur} position={[x, 4.5, 3.6]} castShadow>
            <boxGeometry args={[2.2, 9, 2.2]} />
          </mesh>
          <mesh material={m.dark} position={[x, 0.6, 4.6]}>
            <boxGeometry args={[2.8, 1.2, 3]} />
          </mesh>
        </group>
      ))}
      {/* Sırttaki kırağı tutamları */}
      {(
        [
          [-2, 13, -3, -0.4],
          [1.5, 13.6, -4.5, 0.3],
          [0, 12, -7, 0],
        ] as const
      ).map(([x, y, z, rz], i) => (
        <mesh key={i} material={m.white} position={[x, y, z]} rotation={[-0.6, 0, rz]}>
          <coneGeometry args={[1, 2.6, 4]} />
        </mesh>
      ))}
      {/* Kafa: burun, kulaklar, buz mavisi gözler */}
      <group ref={headRef} position={[0, 16.5, 3]}>
        <mesh material={m.fur} scale={[1, 0.9, 1.1]} castShadow>
          <icosahedronGeometry args={[3.8, 0]} />
        </mesh>
        <mesh material={m.white} position={[0, -1, 3.6]} castShadow>
          <boxGeometry args={[2.6, 2.2, 4]} />
        </mesh>
        <mesh material={m.nose} position={[0, -0.3, 5.7]}>
          <boxGeometry args={[1.2, 0.9, 0.6]} />
        </mesh>
        <group ref={earsRef}>
          {[-2, 2].map((x) => (
            <mesh key={x} material={m.dark} position={[x, 3.4, -0.5]} rotation-z={x < 0 ? 0.25 : -0.25} castShadow>
              <coneGeometry args={[1.1, 3.2, 4]} />
            </mesh>
          ))}
        </group>
        {[-1.4, 1.4].map((x) => (
          <mesh key={x} material={m.eye} position={[x, 0.9, 3.3]}>
            <boxGeometry args={[0.9, 0.6, 0.3]} />
          </mesh>
        ))}
      </group>
      {/* Kuyruk: arkadan yukarı kıvrılır, ağır ağır sallanır */}
      <group ref={tailRef} position={[0, 4, -9]}>
        <mesh material={m.fur} position={[0, 3, -2.5]} rotation-x={-0.9} scale={[0.8, 0.8, 2.4]} castShadow>
          <icosahedronGeometry args={[2.5, 0]} />
        </mesh>
        <mesh material={m.white} position={[0, 6.2, -4.6]} rotation-x={-0.9}>
          <icosahedronGeometry args={[1.5, 0]} />
        </mesh>
      </group>
      {/* Fırtınanın buz kristalleri */}
      <group ref={stormRef}>
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * Math.PI * 2;
          return (
            <mesh key={k} material={m.crystal} position={[Math.cos(a) * 13, 6 + (k % 3) * 5, Math.sin(a) * 13]}>
              <octahedronGeometry args={[0.9, 0]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ── Kışgölgesi Han ─────────────────────────────────────────────────

export function KisgolgesiHan({ animate }: { animate: boolean }) {
  const bodyRef = useRef<Group>(null);
  const wispsRef = useRef<Group>(null);
  const stoneRef = useRef<Mesh>(null);

  const m = useDisposable(() => ({
    cloak: new MeshLambertMaterial({ color: "#3e3352", flatShading: true }),
    cloakLight: new MeshLambertMaterial({ color: "#5a4a78", flatShading: true }),
    shadow: new MeshBasicMaterial({ color: "#141019" }),
    eye: new MeshBasicMaterial({ color: "#f6d36f" }),
    gold: new MeshLambertMaterial({ color: "#f6d36f", emissive: "#a8741c", emissiveIntensity: 0.6, flatShading: true, side: DoubleSide }),
    gem: new MeshBasicMaterial({ color: "#59c2ff" }),
    staff: new MeshLambertMaterial({ color: "#4a3626", flatShading: true }),
    hand: new MeshLambertMaterial({ color: "#c9b8a8", flatShading: true }),
    stone: new MeshLambertMaterial({ color: "#8c7a52", emissive: "#6a5a3a", emissiveIntensity: 0.4, flatShading: true }),
    frost: new MeshLambertMaterial({ color: "#c3e0f2", flatShading: true }),
    wisp: new MeshLambertMaterial({ color: "#1a1424", transparent: true, opacity: 0.6, depthWrite: false, flatShading: true }),
  }));

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 0.9) * 0.35;
      bodyRef.current.rotation.z = Math.sin(t * 0.4) * 0.02;
    }
    if (wispsRef.current) {
      wispsRef.current.rotation.y = -t * 0.4;
      wispsRef.current.children.forEach((wisp, k) => wisp.scale.setScalar(0.8 + Math.sin(t * 2 + k) * 0.25));
    }
    // Günözü Taşı'nın soluk nabzı
    if (stoneRef.current) {
      stoneRef.current.rotation.y = t * 0.7;
      m.stone.emissiveIntensity = 0.3 + (Math.sin(t * 1.8) * 0.5 + 0.5) * 0.35;
    }
  });

  return (
    <group>
      {/* Ayak dibindeki gölge dilleri */}
      <group ref={wispsRef}>
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * Math.PI * 2;
          return (
            <mesh key={k} material={m.wisp} position={[Math.cos(a) * 8.5, 2, Math.sin(a) * 8.5]}>
              <coneGeometry args={[1.4, 5, 5]} />
            </mesh>
          );
        })}
      </group>
      <group ref={bodyRef}>
        {/* Pelerin: kırağılı etek, açık renkli ön kenar, omuzlar */}
        <mesh material={m.cloak} position-y={11} castShadow>
          <coneGeometry args={[7, 22, 8]} />
        </mesh>
        <mesh material={m.cloakLight} position={[-1.5, 10, 2.6]} rotation-z={0.05}>
          <boxGeometry args={[1.2, 18, 0.6]} />
        </mesh>
        <mesh material={m.frost} position-y={0.5} rotation-x={Math.PI / 2}>
          <torusGeometry args={[6.8, 0.45, 4, 16]} />
        </mesh>
        <mesh material={m.cloakLight} position-y={21} scale={[1.6, 0.7, 1]} castShadow>
          <icosahedronGeometry args={[4.2, 0]} />
        </mesh>
        {/* Başlık, gölgeli yüz, iki altın göz */}
        <mesh material={m.cloak} position-y={25.5} castShadow>
          <icosahedronGeometry args={[3.4, 0]} />
        </mesh>
        <mesh material={m.shadow} position={[0, 25.2, 1.6]}>
          <icosahedronGeometry args={[2.5, 0]} />
        </mesh>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} material={m.eye} position={[x, 25.6, 3.9]}>
            <boxGeometry args={[0.9, 0.45, 0.3]} />
          </mesh>
        ))}
        {/* Taç */}
        <mesh material={m.gold} position-y={28.6} castShadow>
          <cylinderGeometry args={[2.9, 3, 1.2, 10, 1, true]} />
        </mesh>
        {[0, 1, 2, 3, 4].map((k) => {
          const a = (k / 5) * Math.PI * 2 + Math.PI / 2;
          return (
            <mesh key={k} material={m.gold} position={[Math.cos(a) * 2.6, 30, Math.sin(a) * 2.6]}>
              <coneGeometry args={[0.55, 1.9, 4]} />
            </mesh>
          );
        })}
        <mesh material={m.gem} position={[0, 28.7, 3]}>
          <octahedronGeometry args={[0.6, 0]} />
        </mesh>
        {/* Asa ve Günözü Taşı */}
        <mesh material={m.hand} position={[5.4, 18, 2]}>
          <icosahedronGeometry args={[1.3, 0]} />
        </mesh>
        <mesh material={m.staff} position={[6.4, 15, 1.6]} castShadow>
          <cylinderGeometry args={[0.35, 0.4, 30, 6]} />
        </mesh>
        <mesh ref={stoneRef} material={m.stone} position={[6.4, 31.6, 1.6]} castShadow>
          <octahedronGeometry args={[1.7, 0]} />
        </mesh>
      </group>
    </group>
  );
}
