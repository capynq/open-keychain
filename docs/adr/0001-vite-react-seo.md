# ADR 0001: Keep Vite/React for the SEO surfaces

Status: accepted

## Decision

Remain on Vite and React, rendering the SEO catalog and metadata in the client application. Netlify
serves one static `index.html` with an SPA fallback.

## Context

Geometry, WebGL, workers, and browser font handling are client-oriented and already share the
customizer runtime. Next.js static export would reintroduce generated route HTML and a second build
contract. Runtime Next.js rendering would require operating a React server alongside the optional
Fastify API.

Revisit this decision only if server-rendered or build-time SEO becomes a hard requirement.
