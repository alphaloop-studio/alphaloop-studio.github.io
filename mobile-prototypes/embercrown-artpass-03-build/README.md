# EMBERCROWN Art Pass 0.3 build recipe

This folder reconstructs Art Pass 0.3 from the verified Art Pass 0.2 source, then the GitHub Actions workflow:

1. applies the compressed source patch,
2. vendors Babylon.js 9.23.0 and its glTF loader from pinned npm packages,
3. mirrors pinned CC0 KayKit GLB assets,
4. generates EMBERCROWN-specific palette atlases,
5. runs static and mobile Playwright QA,
6. publishes only the verified output to `mobile-prototypes/embercrown-artpass-03`.

The runtime output has no third-party CDN dependency. The build recipe remains auditable without duplicating large binary assets in source control.

Build trigger revision: 1.
