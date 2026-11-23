import express from "express";
import type { Request, Response } from "express";
import { assets, balances, db, markets, orders, users } from "@repo/db";
import { and, eq, sql } from "drizzle-orm";
import { ApiError, placeOrder } from "../orders/service";

const MM = express.Router();

type SeedAsset = { symbol: string; name: string; decimals: number };
type SeedMarket = {
  symbol: string;
  base: string;
  quote: string;
  tickSize: string;
  stepSize: string;
  minOrderSize: string;
};
type SeedUser = { id: number; name: string; email: string; passHash: string };
type SeedBalance = { userId: number; asset: string; available: string };
type SeedData = {
  mmUserId: number;
  users: SeedUser[];
  assets: SeedAsset[];
  markets: SeedMarket[];
  balances: SeedBalance[];
};

const loadSeed = async (req: Request): Promise<SeedData> => {
  if (req.body && Object.keys(req.body).length > 0) return req.body as SeedData;
  return Bun.file(new URL("./seed.json", import.meta.url)).json() as Promise<SeedData>;
};

const ensureAsset = async (input: SeedAsset) => {
  const [existing] = await db.select().from(assets).where(eq(assets.symbol, input.symbol));
  if (existing) return existing;
  const [created] = await db.insert(assets).values(input).returning();
  return created;
};

const ensureUser = async (input: SeedUser) => {
  await db.execute(sql`
    INSERT INTO users (id, name, email, pass_hash)
    OVERRIDING SYSTEM VALUE
    VALUES (${input.id}, ${input.name}, ${input.email}, ${input.passHash})
    ON CONFLICT (id) DO NOTHING
  `);
  const [row] = await db.select().from(users).where(eq(users.id, input.id));
  return row;
};

const ensureMarket = async (input: SeedMarket, baseId: number, quoteId: number) => {
  const [existing] = await db.select().from(markets).where(eq(markets.symbol, input.symbol));
  if (existing) return existing;
  const [created] = await db.insert(markets).values({
    symbol: input.symbol,
    baseAssetId: baseId,
    quoteAssetId: quoteId,
    tickSize: BigInt(input.tickSize),
    stepSize: BigInt(input.stepSize),
    minOrderSize: BigInt(input.minOrderSize),
  }).returning();
  return created;
};

MM.post("/seed", async (req: Request, res: Response) => {
  try {
    const seed = await loadSeed(req);
    const assetIds: Record<string, number> = {};

    for (const input of seed.assets) {
      const row = await ensureAsset(input);
      if (row) assetIds[input.symbol] = row.id;
    }

    for (const input of seed.users) await ensureUser(input);

    for (const input of seed.markets) {
      const baseId = assetIds[input.base];
      const quoteId = assetIds[input.quote];
      if (!baseId || !quoteId) throw new ApiError(400, `missing asset for ${input.symbol}`);
      await ensureMarket(input, baseId, quoteId);
    }

    for (const input of seed.balances) {
      const assetId = assetIds[input.asset];
      if (!assetId) throw new ApiError(400, `missing asset ${input.asset}`);
      await db.insert(balances).values({
        userId: input.userId,
        assetId,
        available: BigInt(input.available),
        locked: 0n,
      }).onConflictDoNothing();
    }

    return res.status(200).json({
      seeded: true,
      assets: seed.assets.length,
      users: seed.users.length,
      markets: seed.markets.length,
      balances: seed.balances.length,
    });
  } catch (e) {
    console.error("[mm/seed]", e);
    if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "internal error" });
  }
});

MM.post("/seed-liquidity", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const { symbol, midPrice, halfSpread, qty, levels } = body;
    if (!symbol || !midPrice || !qty) {
      throw new ApiError(400, "symbol, midPrice and qty are required");
    }

    const mmUserId = body.userId != null ? Number(body.userId) : 127;

    const [market] = await db.select().from(markets).where(eq(markets.symbol, String(symbol)));
    if (!market) throw new ApiError(400, "market not found - run /mm/seed first");

    const [mmUser] = await db.select().from(users).where(eq(users.id, mmUserId));
    if (!mmUser) throw new ApiError(400, "market maker user not found - run /mm/seed first");

    const existing = await db.select({ id: orders.id }).from(orders)
      .where(and(eq(orders.userId, mmUserId), eq(orders.marketId, market.id)));
    if (existing.length > 0) {
      return res.status(200).json({
        placed: 0,
        alreadySeeded: true,
        orders: existing.map((o) => o.id.toString()),
      });
    }

    const quantity = BigInt(qty);
    if (quantity % market.stepSize !== 0n) throw new ApiError(400, "bad step");
    if (quantity < market.minOrderSize) throw new ApiError(400, "order too small");

    const mid = BigInt(midPrice);
    const spread = BigInt(halfSpread ?? market.tickSize * 5n);
    const depth = Number(levels ?? 5);
    if (!Number.isInteger(depth) || depth < 1 || depth > 100) {
      throw new ApiError(400, "levels must be an integer between 1 and 100");
    }
    if (mid <= spread || mid % market.tickSize !== 0n || spread % market.tickSize !== 0n) {
      throw new ApiError(400, "midPrice and halfSpread must be tick-aligned, with midPrice above halfSpread");
    }

    const [base] = await db.select().from(assets).where(eq(assets.id, market.baseAssetId));
    if (!base) throw new ApiError(500, "base asset missing");

    let requiredQuote = 0n;
    for (let i = 0; i < depth; i++) {
      requiredQuote += ((mid - spread - BigInt(i) * market.tickSize) * quantity) / 10n ** BigInt(base.decimals);
    }
    const [quoteBalance] = await db.select().from(balances)
      .where(and(eq(balances.userId, mmUserId), eq(balances.assetId, market.quoteAssetId)));
    if (!quoteBalance || quoteBalance.available < requiredQuote) {
      throw new ApiError(422, "Insufficient quote balance");
    }

    const requiredBase = quantity * BigInt(depth);
    const [baseBalance] = await db.select().from(balances)
      .where(and(eq(balances.userId, mmUserId), eq(balances.assetId, market.baseAssetId)));
    if (!baseBalance || baseBalance.available < requiredBase) {
      throw new ApiError(422, "Insufficient base balance");
    }

    const placed: { orderId: string; side: string; price: string; qty: string }[] = [];
    for (let i = 0; i < depth; i++) {
      const offset = BigInt(i) * market.tickSize;
      const levelsToPlace = [
        { side: "buy" as const, price: mid - spread - offset },
        { side: "sell" as const, price: mid + spread + offset },
      ];

      for (const level of levelsToPlace) {
        const order = await placeOrder({
          userId: mmUserId,
          marketId: market.id,
          side: level.side,
          type: "limit",
          price: level.price,
          qty: quantity,
        });
        placed.push({
          orderId: order.id.toString(),
          side: level.side,
          price: level.price.toString(),
          qty: quantity.toString(),
        });
      }
    }

    return res.status(201).json({ marketId: market.id, placed: placed.length, orders: placed });
  } catch (e) {
    if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: "internal error" });
  }
});

export default MM;
