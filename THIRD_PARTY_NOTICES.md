# Third-party dependencies

Exact dependency versions are recorded in `package-lock.json`. Browser bundles
are built locally; no CDN is required to use the published site.

| Runtime package | Version | License |
| --------------- | ------- | ------- |
| React           | 18.3.1  | MIT     |
| React DOM       | 18.3.1  | MIT     |
| Scheduler       | 0.23.2  | MIT     |
| XState          | 5.33.3  | MIT     |
| loose-envify    | 1.4.0   | MIT     |
| js-tokens       | 4.0.0   | MIT     |

The distribution includes the original license texts in `licenses/<package>.txt`,
including notices for the installed runtime dependency chain.

| Development tool | Version | License    |
| ---------------- | ------- | ---------- |
| esbuild          | 0.28.2  | MIT        |
| ESLint           | 10.13.0 | MIT        |
| Prettier         | 3.9.10  | MIT        |
| Playwright Test  | 1.57.0  | Apache-2.0 |

Development tools are not loaded by the published pages. Their original notices
are available with the installed packages in `node_modules/`.
