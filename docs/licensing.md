# Licensing and distribution

## Project source

Open Keychain source is distributed under the [MIT License](../LICENSE). Subject to that license, people may use, copy, modify, distribute, sublicense, and sell the software, including for commercial self-hosting and a paid hosted service. The license notice must remain in copies or substantial portions of the software.

MIT does not grant hosted exclusivity. Another person or company may operate an unmodified or modified Open Keychain service. Product differentiation must come from reliability, operations, support, integrations, brand, and validated workflows rather than a claim that the source cannot be hosted elsewhere.

Do not modify the license text to imply a source-available restriction, hosted-service restriction, or prohibition on commercial use.

## Fonts and other dependencies

Bundled fonts are third-party assets and retain their own licenses. The current font notices are in [`public/fonts/licenses/`](../public/fonts/licenses/). The catalog uses fonts from Google Fonts under the SIL Open Font License, but each bundled notice remains the source of truth for redistribution requirements.

Before adding or replacing a font:

- [ ] Confirm the license permits the intended bundling and commercial use.
- [ ] Keep the license/notice file with the asset.
- [ ] Check Latin/Cyrillic glyph coverage and document the supported script behavior.
- [ ] Check whether the font is suitable for articulated geometry and physical printing.
- [ ] Include the font in export and print-quality regression fixtures where applicable.

Review licenses for runtime, build, and server dependencies before distributing a complete product image. The repository's MIT license does not replace third-party notices.

## Hosted service implications

MIT allows the project maintainer or another operator to run a paid hosted service. Hosted production still needs separate decisions and documents for:

- Service name, trademarks, branding, and domain ownership.
- Privacy, terms, cookies, retention, deletion, and customer support.
- Pricing, taxes, refunds, invoices, and payment-provider obligations.
- Ownership and permitted use of customer names, project parameters, thumbnails, and generated outputs.
- Disclosure that the service may be operated from a self-hosted or modified codebase.

The current repository does not define a customer-output ownership policy. Resolve that policy before accepting paid hosted data and keep it separate from the software license.

## Generated files

STL and 3MF files are generated from user-selected text, fonts, and parameters. The application should document how users may use and sell their generated products, while separately respecting third-party font licenses and any customer-provided material. Do not claim that the MIT license automatically governs every font, model, name, or customer asset involved in a generated file.
