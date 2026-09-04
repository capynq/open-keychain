# WebMCP

Open Keychain 3D exposes a small browser-local tool surface for agents that support WebMCP.
Tools are registered by the customizer at runtime through `document.modelContext`; they operate
on the active design in the open browser tab and do not replace the normal human-facing controls.

## Discovery

The public discovery surfaces are:

- [`/llms.txt`](https://open-keychain.com/llms.txt) — the human- and model-readable site overview.
- The HTML `describedby` link and equivalent HTTP `Link` header.

The `Permissions-Policy` response header explicitly allows `tools` for the site origin, so a
WebMCP-capable browser can expose the registered tools.

Open [`/create`](https://open-keychain.com/create) to create a design before invoking a tool.

The customizer publishes two tools:

- `get-keychain-state` reports the active text, subtitle, template/style IDs, font, preview status,
  printability, dimensions, and any validation error. It is read-only.
- `customize-keychain` requires 1–24 characters of main text and optionally accepts a subtitle,
  template, or style. Template and style values are limited to the IDs currently published by
  the customizer catalogs; omitted fields remain unchanged.

## Browser support

This is native progressive enhancement with no polyfill. Chrome 149 currently requires the
WebMCP origin trial; local testing can enable `chrome://flags/#enable-webmcp-testing`. Ordinary
browsers continue to use the normal customizer with no WebMCP dependency.

## Safety and boundaries

WebMCP actions are scoped to the current browser session. Geometry generation and STL/3MF export
remain local to the browser. Agents should confirm user intent before changing a design or
starting an export, and should treat exported files as user-controlled output.

The optional API server is not required for WebMCP or for the local-first customizer workflow.
