import { redis } from "@repo/redis";
import { orderResponse, type OrderResponse } from "@repo/types";
import { db, orders, eq, and, inArray, asc } from "@repo/db";

const bids = new Map<bigint, OrderResponse[]>();
const asks = new Map<bigint, OrderResponse[]>();

const loadOpenOrders = async (marketId: number) => {

  return db
    .select()
    .from(orders)
    .where(and(
      eq(orders.marketId, marketId),
      eq(orders.type, "limit"),
      inArray(orders.status, ["open", "partially_filled"]),
    ))
    .orderBy(asc(orders.id));
};


const addBook = (order : OrderResponse)=>{
  const book = order.side == "buy" ? bids : asks;
  if (order.price === null) return; 
  const price = BigInt(order.price); 
  const list = book.get(price) ?? [];
  list.push(order);
  book.set(price, list);
}


const bestBid = ()=>{
  let bestBid : bigint |  undefined;

  for(const bid of bids.keys()){
    if(bestBid == undefined || bid > bestBid){
      bestBid = bid;
    }
  }

  return bestBid;
};

const bestAsk = ()=>{
  let bestBid : bigint |  undefined;

  for(const bid of asks.keys()){
    if(bestBid == undefined || bid < bestBid){
      bestBid = bid;
    }
  }

  return bestBid;
};

const main = async () => {
  const marketId = Number(1);
  if (!marketId) throw new Error("MARKET_ID missing");

  const rows = await loadOpenOrders(marketId);
  for (const row of rows) {
    addBook(orderResponse.parse(row));
  }

  console.log("loaded", rows.length, "orders");
  console.log("best bid", bestBid(), "best ask", bestAsk());
};

main().catch((e) => {
  console.error("engine crashed", e);
  process.exit(1);
});