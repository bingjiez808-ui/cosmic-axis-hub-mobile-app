/* eslint-disable react/no-unknown-property */
/**
 * Lanyard — 3D reader's-pass lanyard for the Destiny Library. Adapted
 * from the React Bits Lanyard component, with these library-specific
 * changes:
 *
 *   - GLB and band texture load from CDN URLs (not bundled binaries).
 *   - Lightformer / white studio env replaced with warm-gold key light
 *     + cool-blue rim light to sit inside the interior video mood.
 *   - Card material eased off "shiny plastic" (roughness ~0.8, low
 *     metalness, mild clearcoat) — reads as an old library card.
 *   - Drag-vs-click detection promoted to pointer up: <6px + <250ms
 *     fires `onCardTap`; larger movement / longer hold stays a drag.
 *   - Lanyard band pointer events don't trigger the tap callback.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";

import cardGlbAsset from "./assets/card.glb.asset.json";
import lanyardBandAsset from "./assets/lanyard-band.png.asset.json";
import "./Lanyard.css";

extend({ MeshLineGeometry, MeshLineMaterial });

const BLANK_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Card model UV atlas: front on the left, back on the right (measured
// from the React Bits card.glb).
const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 };

export type LanyardProps = {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
  frontImage?: string | null;
  backImage?: string | null;
  imageFit?: "cover" | "contain";
  lanyardImage?: string | null;
  lanyardWidth?: number;
  onCardTap?: () => void;
  dpr?: [number, number] | number;
  paused?: boolean;
};

export default function Lanyard({
  position = [0, 0, 22],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  frontImage = null,
  backImage = null,
  imageFit = "cover",
  lanyardImage = null,
  lanyardWidth = 1.15,
  onCardTap,
  dpr,
  paused = false,
}: LanyardProps) {
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  return (
    <div className="reader-pass-lanyard">
      <Canvas
        camera={{ position, fov }}
        dpr={dpr ?? [1, Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5)]}
        frameloop={paused ? "never" : "always"}
        gl={{ alpha: transparent, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)
        }
      >
        {/* Warm library key light + cool rim, no white studio env. */}
        <ambientLight intensity={0.35} color="#f2e6c0" />
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.6}
          color="#f0c987"
        />
        <directionalLight
          position={[-4, 2, -3]}
          intensity={0.6}
          color="#5c7dab"
        />

        <Physics gravity={gravity} timeStep={1 / 60}>
          <Band
            isMobile={isMobile}
            frontImage={frontImage}
            backImage={backImage}
            imageFit={imageFit}
            lanyardImage={lanyardImage}
            lanyardWidth={lanyardWidth}
            onCardTap={onCardTap}
          />
        </Physics>
      </Canvas>
    </div>
  );
}

type BandProps = {
  isMobile: boolean;
  maxSpeed?: number;
  minSpeed?: number;
  frontImage?: string | null;
  backImage?: string | null;
  imageFit?: "cover" | "contain";
  lanyardImage?: string | null;
  lanyardWidth?: number;
  onCardTap?: () => void;
};

function Band({
  isMobile,
  maxSpeed = 50,
  minSpeed = 0,
  frontImage = null,
  backImage = null,
  imageFit = "cover",
  lanyardImage = null,
  lanyardWidth = 1.15,
  onCardTap,
}: BandProps) {
  const band = useRef<THREE.Mesh | null>(null);
  const fixed = useRef<RapierRigidBody | null>(null);
  const j1 = useRef<RapierRigidBody | null>(null);
  const j2 = useRef<RapierRigidBody | null>(null);
  const j3 = useRef<RapierRigidBody | null>(null);
  const card = useRef<RapierRigidBody | null>(null);

  const vec = useMemo(() => new THREE.Vector3(), []);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const segmentProps = {
    type: "dynamic" as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { nodes, materials } = useGLTF(cardGlbAsset.url) as any;
  const texture = useTexture(lanyardImage || lanyardBandAsset.url);
  const frontTex = useTexture(frontImage || BLANK_PIXEL);
  const backTex = useTexture(backImage || BLANK_PIXEL);

  // Composite the front/back SVG textures into the atlas.
  const cardMap = useMemo(() => {
    const baseMap = materials.base.map as THREE.Texture;
    if (!frontImage && !backImage) return baseMap;
    const baseImg = baseMap.image as HTMLImageElement | HTMLCanvasElement;
    const W = baseImg.width;
    const H = baseImg.height;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return baseMap;
    ctx.drawImage(baseImg as CanvasImageSource, 0, 0, W, H);

    const drawFitted = (img: HTMLImageElement, rect: typeof FRONT_UV_RECT) => {
      const rx = rect.x * W;
      const ry = rect.y * H;
      const rw = rect.w * W;
      const rh = rect.h * H;
      const pick = imageFit === "contain" ? Math.min : Math.max;
      const scale = pick(rw / img.width, rh / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = rx + (rw - dw) / 2;
      const dy = ry + (rh - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    };

    if (frontImage && frontTex.image)
      drawFitted(frontTex.image as HTMLImageElement, FRONT_UV_RECT);
    if (backImage && backTex.image)
      drawFitted(backTex.image as HTMLImageElement, BACK_UV_RECT);

    const composite = new THREE.CanvasTexture(canvas);
    composite.colorSpace = THREE.SRGBColorSpace;
    composite.flipY = baseMap.flipY;
    composite.anisotropy = 16;
    composite.needsUpdate = true;
    return composite;
  }, [frontImage, backImage, imageFit, frontTex, backTex, materials]);

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  const [dragged, setDragged] = useState<false | THREE.Vector3>(false);
  const [hovered, setHovered] = useState(false);

  // Tap vs drag detection.
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const TAP_THRESHOLD_PX = 6;
  const TAP_MAX_MS = 250;

  // Rapier ref types are non-nullable; our refs are nullable until mount.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  useRopeJoint(fixed as any, j1 as any, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1 as any, j2 as any, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2 as any, j3 as any, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3 as any, card as any, [
    [0, 0, 0],
    [0, 1.5, 0],
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  useEffect(() => {
    if (!hovered) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = prev || "auto";
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current && j1.current && j2.current && j3.current && card.current && band.current) {
      [j1, j2].forEach((ref) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyRef = ref.current as any;
        if (!anyRef.lerped) anyRef.lerped = new THREE.Vector3().copy(anyRef.translation());
        const clampedDistance = Math.max(
          0.1,
          Math.min(1, anyRef.lerped.distanceTo(anyRef.translation())),
        );
        anyRef.lerped.lerp(
          anyRef.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)),
        );
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j1a = j1.current as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j2a = j2.current as any;
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2a.lerped);
      curve.points[2].copy(j1a.lerped);
      curve.points[3].copy(fixed.current.translation());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (band.current.geometry as any).setPoints(curve.getPoints(56));
      ang.copy(card.current.angvel() as unknown as THREE.Vector3);
      rot.copy(card.current.rotation() as unknown as THREE.Vector3);
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }
  });

  curve.curveType = "chordal";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
              (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
              const start = pointerStart.current;
              pointerStart.current = null;
              setDragged(false);
              if (!start || !onCardTap) return;
              const dx = e.clientX - start.x;
              const dy = e.clientY - start.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const dt = performance.now() - start.t;
              if (dist < TAP_THRESHOLD_PX && dt < TAP_MAX_MS) {
                onCardTap();
              }
            }}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
              pointerStart.current = { x: e.clientX, y: e.clientY, t: performance.now() };
              if (card.current) {
                setDragged(
                  new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation() as unknown as THREE.Vector3)),
                );
              }
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={cardMap}
                map-anisotropy={16}
                clearcoat={0.35}
                clearcoatRoughness={0.35}
                roughness={0.8}
                metalness={0.18}
              />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.35} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      {/* meshLineGeometry / meshLineMaterial are extended via extend(...)
          above; use string tags cast to any to bypass R3F's ThreeElements
          check without a global JSX augmentation. */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <mesh ref={band as any}>
        {(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const G = "meshLineGeometry" as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const M = "meshLineMaterial" as any;
          return (
            <>
              <G />
              <M
                color="#e8c37a"
                depthTest={false}
                resolution={[isMobile ? 800 : 1400, isMobile ? 900 : 1400]}
                useMap
                map={texture}
                repeat={[-3, 1]}
                lineWidth={lanyardWidth}
              />
            </>
          );
        })()}
      </mesh>
    </>
  );
}

// Preload so the pass appears fast once the container mounts.
useGLTF.preload(cardGlbAsset.url);
