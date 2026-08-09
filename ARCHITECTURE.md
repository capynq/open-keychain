# Architecture

## Runtime

```text
React controls ── latest params ──> GeometryClient ──> Web Worker
      │                                  │              │
      │                                  │              ├─ local fonts + OpenType
      │                                  │              ├─ 2D CrossSection operations
      │                                  │              ├─ Manifold WASM solids
      │                                  │              └─ STL serializer
      └──────────── MeshBuffers <────────┘
                         │
                    Three.js viewer
```

The main thread owns React state, controls, local preferences, and Three.js. Geometry is deliberately isolated in one persistent worker so slider movement cannot freeze the interface. Requests are coalesced: a pending preview is replaced by the newest parameters, while stale responses are ignored by the client.

## Geometry pipeline

1. Normalize and constrain consumer parameters.
2. Load a known local font, use script-aware catalog metadata in the UI, and check every requested character in the worker.
3. Lay out glyphs explicitly with kerning and composite glyph support. This avoids fragile optional OpenType substitution lookups while preserving normal Latin text.
4. Flatten quadratic and cubic outlines using adaptive error tolerance, remove duplicate points, and normalize to the requested text height.
5. Build EvenOdd contours so counters in letters remain holes.
6. Compose one of six style recipes from shared rounded plates, offsets, connectors, hull bridges, and ring primitives.
7. Extrude the base and overlap a separate raised-text solid by 0.15 mm to avoid coincident surfaces.
8. Validate finite coordinates, Manifold status, connected components, dimensions, and mesh buffers.
9. Transfer base/relief mesh buffers to Three.js. Rebuild a fresh high-quality combined mesh only when STL is requested.

The preview uses the same geometry result as export, split into base and relief materials. STL is the MVP export because it is universally accepted and keeps the download path small; 3MF can be added later when multipart/material semantics justify the extra implementation and validation.

## Extension boundary

`src/geometry/styles.ts` is a small typed style catalog. New keychain recipes should compose the existing primitives rather than create a second geometry engine. A later customizer can use the same `KeychainParams`-shaped builder boundary, but no runtime plugin system is needed today.

## Deliberate non-decisions

- No server or database: all MVP state is local and generation is client-side.
- No React Three Fiber: direct Three.js keeps the viewer lifecycle and buffer disposal explicit.
- No JSCAD: Manifold offers the needed 2D operations and stronger manifold-solid guarantees with a smaller geometry surface for this model.
- No uploaded fonts: known bundled assets make licensing, security, and printability predictable.
