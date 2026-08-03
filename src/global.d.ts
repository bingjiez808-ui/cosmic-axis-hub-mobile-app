/// <reference types="vite/client" />

declare module "meshline" {
  // Only referenced for `extend(...)` and JSX intrinsic elements.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MeshLineGeometry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MeshLineMaterial: any;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace JSX {
  interface IntrinsicElements {
    // MeshLine extensions used inside src/components/reader-pass/Lanyard.tsx.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meshLineGeometry: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meshLineMaterial: any;
  }
}
