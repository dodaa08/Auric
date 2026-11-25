import { db, markets, orders } from "@repo/db";
import { and, eq, inArray } from "drizzle-orm";
import express, { type Request, type Response } from "express";

const marketR = express.Router();
const serialize = (obj: unknown) =>
  JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)))


const GetAllMarkets = async (req : Request, res : Response)=>{
    try{
        const marketD  = await db.select().from(markets);
        if(!marketD){
            res.status(404).json({
                message : "No market data found."
            });
        }

        return res.status(200).json({
            data : serialize(marketD)
        });

    }catch(e){
        console.error("list markets failed", e);
    return res.status(500).json({ error: "internal error" });

    }
};


// Get market of id
const getMarketfromId = async (req : Request, res : Response)=>{
    const marketId = Number(req.params.id);
    if(!marketId){
        throw new Error("MarketId invalid or not found.")
    }
    try{
        const marketD = await db.select().from(markets).where(eq(markets.id, marketId));
        if(!marketD){
        res.status(404).json({
                message : "No market data found."
            });
    }
        return res.status(200).json({
            data : marketD
        });
    }
    catch(e){
         console.error("list markets failed", e);
    return res.status(500).json({ error: "internal error" });
    }
};


const getOrderBook = async (req : Request, res : Response)=>{
    const marketId = Number(req.params.id);
    // price and qty
    const bids = new Map<number, bigint>();
    // price and qty
    const asks = new Map<number, bigint>();
    const depth = 20;

    try{
        const rows = await db.select().from(orders).where(and(eq(orders.marketId,  marketId), inArray(orders.status, ["open", "partially_filled"]), eq(orders.type, "limit")));

        
       for (const row of rows) {
    const book = row.side === "buy" ? bids : asks;
    const price = Number(row.price);
    const remaining = row.qty - row.filledQty;

    book.set(price, (book.get(price) ?? 0n) + remaining);
  };

        const bidsList = Array.from(bids.entries()).sort((a,b)=>b[0] - a[0]).slice(0, depth);
        const askList = Array.from(asks.entries()).sort((a,b)=>b[0] - a[0]).slice(0, depth);

        return res.status(200).json({
             marketId : marketId,
             bids : bidsList.map(([p,q])=>[String(p), q.toString()]),
             asks : askList.map(([p,q])=>[String(p), q.toString()])
        });
        // String Array
    }
    catch(e){
        console.error("list markets failed", e);
    return res.status(500).json({ error: "internal error" });
    }
};


const getTrades = async (req : Request, res : Response)=>{

};


// All markets
marketR.get("/", GetAllMarkets);

marketR.get("/:id", getMarketfromId);

// Market of bids and asks
marketR.get("/:id/orderbook", getOrderBook);

export default marketR;