import { sql } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";

export const sideT = t.pgEnum("order_side", ["buy", "sell"]);
export const typeT = t.pgEnum("order_type", ["limit", "market"]);
export const statusT = t.pgEnum("order_status", [
  "open", "partially_filled", "filled", "cancelled", "rejected",
]);

export const users = t.pgTable("users", {
  id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
  name: t.varchar({ length: 255 }).notNull(),
  email: t.varchar({ length: 255 }).unique().notNull(),
  passHash: t.varchar("pass_hash", { length: 255 }).notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table)=>[
    t.check("email_lower_case", sql`${table.email} = lower(${table.email})`)
]);

export const assets  = t.pgTable("assets", {
    id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
    symbol : t.varchar({length : 16}).unique().notNull(),
    name : t.varchar({length : 32}).notNull(),
    decimals : t.integer().notNull(),
    createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  t.check("decimals_non_negative", sql`${table.decimals} >= 0`),
]);

export const balances = t.pgTable("balances", {
    userId: t.integer("user_id").notNull().references(() => users.id),
    assetId : t.integer("asset_id").notNull().references(()=>assets.id),
    available : t.bigint({mode :  "bigint"}).notNull().default(0n),
    locked : t.bigint({mode :  "bigint"}).notNull().default(0n),
    updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table)=>[
     t.primaryKey({ columns : [table.userId, table.assetId]}),
     t.check("available_non_negative", sql`${table.available} >= 0`),
     t.check("locked_non_negative", sql`${table.locked} >= 0`)
]);


export const markets = t.pgTable("markets", {
    id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
    symbol : t.varchar({length : 32}).unique().notNull(),
    baseAssetId : t.integer("base_asset_id").notNull().references(()=>assets.id),
    quoteAssetId : t.integer("quote_asset_id").notNull().references(()=>assets.id),
    tickSize : t.bigint("tick_size", {mode : "bigint"}).notNull(),  // Checks for prices
    stepSize : t.bigint("step_size", {mode : "bigint"}).notNull(),  // checks for currency size
    createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    minOrderSize : t.bigint("min_order_size", { mode: "bigint" }).notNull(),
    isActive : t.boolean("is_active").notNull().default(true),
}, (table)=>[
     t.unique().on(table.baseAssetId, table.quoteAssetId),
     t.check("base_not_quote", sql`${table.baseAssetId} <> ${table.quoteAssetId}`),
     t.check("min_size_positive", sql`${table.minOrderSize} > 0`),
     t.check("tick_positive", sql`${table.tickSize} > 0`),
     t.check("step_positive", sql`${table.stepSize} > 0`),
     t.check("min_size_on_step", sql`${table.minOrderSize} % ${table.stepSize} = 0`),
]);


export const orders = t.pgTable("orders", {
  id: t.bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: t.integer("user_id").notNull().references(() => users.id),
  marketId: t.integer("market_id").notNull().references(() => markets.id),
  side: sideT("side").notNull(),
  type: typeT("type").notNull(),
  price: t.bigint("price", { mode: "bigint" }),
  qty: t.bigint("qty", { mode: "bigint" }).notNull(),
  filledQty: t.bigint("filled_qty", { mode: "bigint" }).notNull().default(0n),
  lockedAmount: t.bigint("locked_amount", { mode: "bigint" }).notNull(),
  status: statusT("status").notNull().default("open"),
  createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: t.timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  t.check("qty_positive", sql`${table.qty} > 0`),
  t.check("filled_range", sql`${table.filledQty} >= 0 AND ${table.filledQty} <= ${table.qty}`),
  t.check("price_positive", sql`${table.price} IS NULL OR ${table.price} > 0`),
  t.check("price_matches_type", sql`(${table.type} = 'limit' AND ${table.price} IS NOT NULL) OR (${table.type} = 'market' AND ${table.price} IS NULL)`),
  t.check("check_if_filled_mark_as_qty", sql`${table.status} <> 'filled' OR ${table.filledQty} = ${table.qty}`),
  t.check("locked_amount_non_negative", sql`${table.lockedAmount} >= 0`),
  t.index("orders_market_status_idx").on(table.marketId, table.status),
  t.index("orders_user_created_idx").on(table.userId, table.createdAt),
]);


export const trades = t.pgTable("trades", {
    id: t.bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity(),
    marketId: t.integer("market_id").notNull().references(() => markets.id),
    price: t.bigint("price", { mode: "bigint" }),
    qty: t.bigint("qty", { mode: "bigint" }).notNull(),
    buyOrderid : t.bigint("buy_order_id", {mode : "bigint"}).notNull().references(()=>orders.id),
    sellOrderid : t.bigint("sell_order_id", {mode : "bigint"}).notNull().references(()=>orders.id),
    takerSide: sideT("taker_side").notNull(),
    createdAt: t.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table)=>[
    t.primaryKey({columns : [table.id, table.createdAt]}),
    t.check("trade_price_positive", sql`${table.price} > 0`),
    t.check("trade_qty_positive", sql`${table.qty} > 0`),
    t.check("buy_n_sell_should_not_eq", sql`${table.buyOrderid} <> ${table.sellOrderid}`),
    t.index("trades_market_time__idx").on(table.marketId, table.createdAt)
]);