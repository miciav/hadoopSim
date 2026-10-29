# Third-party dependencies

Exact dependency versions are recorded in `package-lock.json`. Browser bundles
are built locally; no CDN is required to use the published site.

| Runtime package | Version | License |
| --------------- | ------- | ------- |
| React           | 19.3.1  | MIT     |
| React DOM       | 19.3.1  | MIT     |
| Scheduler       | 0.28.0  | MIT     |
| XState          | 5.33.3  | MIT     |

| Font (Lecture skin)                             | Version | License |
| ----------------------------------------------- | ------- | ------- |
| Atkinson Hyperlegible Next (@fontsource, latin) | 5.3.0   | OFL-1.1 |
| Atkinson Hyperlegible Mono (@fontsource, latin) | 5.3.0   | OFL-1.1 |

The distribution includes the original license texts in `licenses/<package>.txt`,
including notices for the installed runtime dependency chain.

| Development tool | Version | License    |
| ---------------- | ------- | ---------- |
| esbuild          | 0.28.2  | MIT        |
| ESLint           | 10.13.0 | MIT        |
| Prettier         | 3.9.10  | MIT        |
| Playwright Test  | 1.64.1  | Apache-2.0 |

Development tools are not loaded by the published pages. Their original notices
are available with the installed packages in `node_modules/`.
