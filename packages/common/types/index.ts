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

export type PlaceOrder = z.infer<typeof createOrderType>;
export type ListQuery = z.infer<typeof listQuery>;