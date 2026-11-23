import { assets, balances, db, markets, orders, users } from "@repo/db";
import { and, eq, gte, sql } from "drizzle-orm";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type OrderInput = {
  userId: number;
  marketId: number;
  side: "buy" | "sell";
  type: "limit" | "market";
  price?: bigint;
  qty: bigint;
};

export const placeOrder = async (input: OrderInput) => {
  const { userId, marketId, price, qty, type, side } = input;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [market] = await db.select().from(markets).where(eq(markets.id, marketId));
  if (!user || !market) throw new ApiError(400, "Incorrect id's");
  if (price != null && price % market.tickSize !== 0n) throw new ApiError(400, "bad tick");
  if (qty % market.stepSize !== 0n) throw new ApiError(400, "bad step");
  if (qty < market.minOrderSize) throw new ApiError(400, "order too small");
  if (type === "market" && side === "buy") throw new Error("market buy not supported yet");

  const [base] = await db.select().from(assets).where(eq(assets.id, market.baseAssetId));
  if (!base) throw new ApiError(500, "base asset missing");

  const lockedAssetId = side === "buy" ? market.quoteAssetId : market.baseAssetId;
  const lockedAmount = side === "buy"
    ? (price! * qty) / 10n ** BigInt(base.decimals)
    : qty;

  return db.transaction(async (tx) => {
    const locked = await tx.update(balances).set({
      available: sql`${balances.available} - ${lockedAmount}`,
      locked: sql`${balances.locked} + ${lockedAmount}`,
    }).where(and(
      eq(balances.userId, userId),
      gte(balances.available, lockedAmount),
      eq(balances.assetId, lockedAssetId),
    ));

    if (!locked.rowCount) throw new ApiError(422, "Insufficient balance");

    const [rows] = await tx.insert(orders).values({
      userId,
      marketId,
      side,
      type,
      price,
      qty,
      lockedAmount,
    }).returning();

    if (!rows) throw new ApiError(500, "failed to create order");
    return rows;
  });
};
