import {z} from "zod";

export const createOrderType = z.object({
    userId : z.number().int().positive(),
    marketId : z.number().int().positive(),
    side : z.enum(["buy", "sell"]),
    type : z.enum(["limit", "market"]),
    price: z.coerce.bigint().positive().optional(),
    qty: z.coerce.bigint().positive(),

}).refine((o) => (o.type === "limit" ? o.price !== undefined : o.price === undefined), {
    message: "limit orders need a price, market orders must not have one",
    path: ["price"],
  });



export const listQuery = z.object({
  status: z.enum(["open", "all", "filled", "cancelled", "rejected"]).default("open"),
  marketId: z.coerce.number().int().positive().optional(),
  side: z.enum(["buy", "sell"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.bigint().positive().optional(), // last order id from the previous page
});

export const orderResponse = z.object({
  id: z.bigint().transform((v) => v.toString()),
  userId: z.number().int(),
  marketId: z.number().int(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["limit", "market"]),
  price: z.bigint().transform((v) => v.toString()).nullable(),
  qty: z.bigint().transform((v) => v.toString()),
  filledQty: z.bigint().transform((v) => v.toString()),
  lockedAmount: z.bigint().transform((v) => v.toString()),
  status: z.enum(["open", "partially_filled", "filled", "cancelled", "rejected"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const streamOrder = z.object({
  id: z.string(),
  userId: z.coerce.number().int(),
  marketId: z.coerce.number().int(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["limit", "market"]),
  price: z.string().transform((v) => (v === "" ? null : v)),
  qty: z.string(),
  filledQty: z.string(),
  lockedAmount: z.string(),
  status: z.enum(["open", "partially_filled", "filled", "cancelled", "rejected"]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PlaceOrder = z.infer<typeof createOrderType>;
export type ListQuery = z.infer<typeof listQuery>;
export type OrderResponse = z.output<typeof orderResponse>;