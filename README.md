# Matching Engine

A centralized cryptocurrency exchange backend.

<img width="1879" height="964" alt="Screenshot From 2026-11-05 16-34-55" src="https://github.com/user-attachments/assets/c5d348dd-2b7e-4f46-af7e-e581d71340ab" />

## Key points

- REST API (Express) for creating, fetching, listing, and canceling orders under `/api/v1/orders`.
- Supports limit/market orders with buy/sell sides and tick-size, step-size, and min-order validation.
- Atomic balance locking on order placement using PostgreSQL transactions (Drizzle ORM).
- PostgreSQL schema for users, assets, balances, markets, orders, and trades, with constraints and TimescaleDB-style hypertable migrations.
- Turborepo monorepo (Bun) with shared DB, types, UI, and config packages.
