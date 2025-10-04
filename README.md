# Wealth Accelerator PWA

An offline-first Progressive Web App that aggregates Indian financial data, delivers AI-assisted categorisation, and provides executive dashboards for cash flow, budgeting, and wealth acceleration.

## Getting started

### Install & run locally

No third-party packages are required. Install the project and launch the embedded static server with:

```bash
npm install
npm run dev
```

The server binds to `http://127.0.0.1:4173` by default, making it easy to exercise the PWA locally even in restricted environments.

To prepare a distributable snapshot in `dist/` and preview it:

```bash
npm run build
npm run preview
```

Run the lightweight offline smoke test to validate that critical application files are present:

```bash
npm run test
```

## Key capabilities

- Secure aggregation layer with mock Plaid/Yodlee connectors and AI-driven transaction categorisation.
- Manual capture flows for accounts, transactions, and bespoke income/expense categories.
- CEO dashboard with net worth, KPI widgets, spending intelligence, and encrypted data export/import controls.
- Unified balance sheet, trend analysis, smart budgeting for variable spends, and a recurring expense hub.
- Goal planning simulator, actionable insights engine, and premium Wealth Accelerator metrics.
- IndexedDB persistence with AES-GCM encryption, PWA manifest, and service worker caching for full offline support.
