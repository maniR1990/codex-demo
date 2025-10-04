# Wealth Accelerator PWA

An offline-first Progressive Web App for Indian households and founders that keeps every feature 100% free, honours user-entered data, and delivers executive-grade insights without relying on paid tiers or synthetic feeds.

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

## Core mandates

- **User cost:** No subscriptions or premium tiers — every capability is accessible to every user.
- **Monetisation:** Non user-paid — optional ethical affiliate suggestions and anonymised trend insights (when explicitly enabled) keep the platform sustainable without selling personal data.
- **Data integrity:** Every record originates from manual entry. There are no synthetic accounts, no bank APIs, and no background enrichment.

## Platform capabilities

- **Phase 1 · Offline data engine**
  - Initial setup wizard that captures currency, start date, and opening balances with zero assumptions.
  - Encrypted IndexedDB snapshot storage with manual JSON/CSV exports and restores.
  - Optional Firebase Authentication + Firestore sync (custom token or anonymous) with conflict-aware merges.
  - Git-linked versioning powered by `isomorphic-git`, including encrypted commits, remote pushes, and automated export rules.
- **Phase 2 · CEO dashboard & analytics**
  - Unified dashboard covering net worth, savings rate, spending trends, and recent activity.
  - Editable balance sheet, trend analysis, smart budgeting, and recurring expense hub tailored for Indian formats.
  - Insights engine that generates timestamped nudges (e.g., leverage risk, income categorisation gaps).
- **Phase 3 · Intelligence & forward planning**
  - Goal simulator, wealth optimisation insights, and context-aware (ethical) affiliate nudges when surplus cash is detected.
  - Smart export automation rules (weekly cadence or transaction thresholds) that trigger encrypted Git commits.
- **Phase 4 · Security & transparency**
  - AES-GCM encryption for local snapshots, HTTPS transport, and a Git audit trail for power users.
  - In-app visibility of data residency (device, Firebase, Git) so users always know where their ledger lives.
