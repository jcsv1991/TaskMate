# TaskMate web app

The React single page app for [TaskMate](../README.md). See the root README for the full feature list, architecture, API reference and deployment guide.

```bash
npm install
npm run dev            # http://localhost:5173, proxies /api to http://localhost:5000
npm run build          # production build in dist/
npm run preview        # serve the production build locally
npm run lint
npm test               # Vitest + Testing Library + MSW
npm run test:coverage
```

Settings are read from `.env.local` (see `.env.example`): `VITE_API_URL`, `VITE_PROXY_TARGET` and `VITE_CURRENCY`. Requires Node.js 22 or 24.
