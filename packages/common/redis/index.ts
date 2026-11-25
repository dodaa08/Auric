import { Redis } from "ioredis";
import type { OrderResponse } from "@repo/types";

export const ORDERS_STREAM = "orders:created";
export const redis = new Redis(process.env.REDIS_URL || `redis://localhost:6379`);

redis.on("error", (error) => {
  console.error("[redis] connection error:", error.message);
});

type FieldValue = string | number | Date | null | undefined;

const seralize = (value : FieldValue)=>{
    if(value == null || value == undefined){
        return "";
    };

    if(value instanceof Date){
        return value.toISOString();
    }

    return String(value);
}

export const pubtoStream = async (order : OrderResponse): Promise<string | null>=>{
        const fields : string[] = [];
        for(const [key, val] of Object.entries(order)){
            fields.push(key, seralize(val));
        };
        return redis.xadd(ORDERS_STREAM, "MAXLEN", "~", 100000 , "*", ...fields);
};


export const ensureGroup = async (group: string) => {
  try {
    await redis.xgroup("CREATE", ORDERS_STREAM, group, "0", "MKSTREAM");
  } catch (e: any) {
    if (!String(e.message).includes("BUSYGROUP")) throw e; // ignore only "already exists"
  }
};


// Graceful shutdown
process.on("SIGTERM", async () => {
  await redis.quit();
  process.exit(0);
});