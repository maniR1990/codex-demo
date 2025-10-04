# Wealth Accelerator PWA

An offline-first Progressive Web App that aggregates Indian financial data, delivers AI-assisted categorisation, and provides executive dashboards for cash flow, budgeting, and wealth acceleration.

## Getting started

### Install & run locally

```bash
npm install
npm run dev
```

> **Tip:** If your environment proxies npm traffic, clear any enforced proxy variables or point npm to an accessible registry, e.g. `npm config set registry https://registry.npmjs.org`.

The Vite dev server binds to `http://127.0.0.1:5173` so the application can be launched locally on any workstation. When you are
ready to ship a production bundle run:

```bash
npm run build
npm run preview
```

Automated checks are available via:

```bash
npm run lint
npm run test
```

## Key capabilities

- Secure aggregation layer with mock Plaid/Yodlee connectors and AI-driven transaction categorisation.
- Manual capture flows for accounts, transactions, and bespoke income/expense categories.
- CEO dashboard with net worth, KPI widgets, spending intelligence, and encrypted data export/import controls.
- Unified balance sheet, trend analysis, smart budgeting for variable spends, and a recurring expense hub.
- Goal planning simulator, actionable insights engine, and premium Wealth Accelerator metrics.
- IndexedDB persistence with AES-GCM encryption, PWA manifest, and service worker caching for full offline support.
