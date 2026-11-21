import express from "express";
const orderR = express.Router();
import type { Request, Response } from "express";
import {assets, balances, db, markets, orders, users} from "@repo/db";
import {eq, gte, and} from "drizzle-orm";
import { sql } from "drizzle-orm";
import { createOrderType, listQuery } from "@repo/types";


class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const CreateOrder = async (req : Request, res : Response)=>{
    const orderD  = createOrderType.safeParse(req.body);
    
    if(!orderD.success) {
        return res.status(404).json({
            message : "no orders found"
        });
    }

    const {userId, marketId, price, qty, type, side } = orderD.data;

    try{
        // 1 Validate the data
        const [userD] = await db.select().from(users).where(eq(users.id,userId));

        const [market] = await  db.select().from(markets).where(eq(markets.id, marketId));
        if (!userD || !market) return res.status(400).json({ message: "Incorrect id's" });
        if (price != null && price % market.tickSize !== 0n) return res.status(400).json({ error: "bad tick" });

        if (qty % market.stepSize !== 0n) return res.status(400).json({ error: "bad step" });

        if(qty < market.minOrderSize){
            return res.status(400).json({ error: "order too small" });
        };

        if (type === "market" && side === "buy") throw new Error( "market buy not supported yet");
        const [base] = await db.select().from(assets).where(eq(assets.id, market.baseAssetId));
        if (!base) throw new ApiError(500, "base asset missing");

        const lockedAssetId = side == "buy" ? market.quoteAssetId : market.baseAssetId;
        const lockedAmount = side == "buy" ? (price! * qty) / 10n ** BigInt(base?.decimals)  : qty;

        // Lock and insert the order update balance in one txn
        const order = await db.transaction(async (tx)=>{
            const locked =  await tx.update(balances).set({
                available : sql`${balances.available} - ${lockedAmount}`,
                locked : sql`${balances.locked} + ${lockedAmount}`
            }).where(and(eq(balances.userId, userId), gte(balances.available, lockedAmount), eq(balances.assetId, lockedAssetId)));

            if(!locked.rowCount){
                throw new ApiError(422, "Insufficient balance");
            }

            // Insert the order
            const [rows]  = await tx.insert(orders).values({
                userId : userId,
                price : price,
                qty : qty,
                marketId : marketId,
                side : side,
                type : type,
                lockedAmount : lockedAmount
            }).returning();

            if (!rows) throw new ApiError(500, "failed to create order");

            return rows;

        });


        // push to stram


        // return order status
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

    try{

        
        
    }
    catch(e){

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

        }

        return res.status(200).json({
            
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