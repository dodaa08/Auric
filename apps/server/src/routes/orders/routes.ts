import express from "express";
const orderR = express.Router();
import type { Request, Response } from "express";
import { db, orders } from "@repo/db";
import { eq, and, inArray, SQL, desc } from "drizzle-orm";
import { createOrderType, listQuery, orderResponse } from "@repo/types";
import { ApiError, placeOrder } from "./service";
import { pubtoStream } from "@repo/redis";

const CreateOrder = async (req : Request, res : Response)=>{
    const orderD = createOrderType.safeParse(req.body);

    if(!orderD.success) {
        return res.status(404).json({
            message : "Invalid body structure or market doesn't exist",
            details: orderD.error.flatten().fieldErrors,
        });
    }

    try{
        const order = await placeOrder(orderD.data);

        // Todo It can crash after db inserts here, so need a retry mechanism
        try {
            await pubtoStream(orderResponse.parse(order));
        } catch (e) {
            console.error("failed to publish order event", e);
        }

        return res.status(201).json({ orderId: order.id.toString(), status: order.status });
    }
    catch(e){
        if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
        return res.status(404).json({
            error : "internal error"
        });
    }
}

const getOrder = async (req : Request, res : Response)=>{
    let orderId: bigint;
    try{
        orderId = BigInt(String(req.params.id)); 
        const [findO] = await db.select().from(orders).where(eq(orders.id, orderId));
        if(!findO){
            throw new ApiError(400, "OrderId invalid");
        };
        
       return res.status(200).json({
  orderId: findO.id.toString(),
  orderStatus: findO.status,
  marketId: findO.marketId,
  side: findO.side,
  type: findO.type,
  price: findO.price?.toString() ?? null,
  qty: findO.qty.toString(),
  filledQty: findO.filledQty.toString(),
  remainingQty: (findO.qty - findO.filledQty).toString(),
  createdAt: findO.createdAt,
  updatedAt: findO.updatedAt,
});

    }
    catch(e){
if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
        return res.status(404).json({
            error : "internal error"
        });
    }
};


const listOrders = async (req : Request, res : Response)=>{
    const filters  = listQuery.safeParse(req.query);
    if(!filters.success){
        return res.status(400).json({ error: "" });
    };

    const { status, marketId, side, limit, cursor } = filters.data;
    const userId = 127;
    const conditions : SQL[] = [eq(orders.userId, userId)];

    try{
        // gib open orders
        if(status == "open"){
            conditions.push(inArray(orders.status, ["open", "partially_filled"]));
        }
        else if(status != "all"){
             conditions.push(eq(orders.status, status));
        };

        if (marketId) conditions.push(eq(orders.marketId, marketId));
        if (side) conditions.push(eq(orders.side, side));

        const rows = await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.id)).limit(limit);

        return res.status(200).json({
            data : rows.map((row) => orderResponse.parse(row))
        });

    }
    catch(e){
        // res.json({ err: e }, "list orders failed");
        return res.status(500).json({ error: "internal error" });
    }
}

// Create the order
orderR.post("/", CreateOrder);
// Get user's order
orderR.get("/:id", getOrder);

// Cancel the order
orderR.delete("/:id", async (req, res)=>{
     let orderId: bigint;
    try{
        orderId = BigInt(String(req.params.id)); 
        const [findO] = await db.select().from(orders).where(eq(orders.id, orderId));
        if(!findO){
            throw new ApiError(400, "OrderId invalid");
        };

        const [rows] = await db.delete(orders).where(eq(orders.id, orderId)).returning();
        
        if(!rows){
            return res.status(404).json({
                message : "order not found"
            });
        }

        return res.status(200).json({
            orderId :  `Deleted order: ${rows.id}`
        });

    }catch(e){
if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
        return res.status(404).json({
            error : "internal error"
        });
    }
});


// Get open orders from history
orderR.get("/", listOrders);

export default orderR;