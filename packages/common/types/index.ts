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

export type PlaceOrder = z.infer<typeof createOrderType>;