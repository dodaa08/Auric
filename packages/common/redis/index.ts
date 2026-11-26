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
    if (!String(e.message).includes("BUSYGROUP")) throw e;
  }
};

type Handler = (order: Record<string, string>, id: string) => Promise<void>;


const toObject = (fields : string[])=>{
   const o : Record<string, string> = {};
   for(let i = 0; i<fields.length; i+=2){
      o[fields[i]!] = fields[i + 1] ?? "";
   };
   return o;
}

// consume
export const consume = async (group : string, name : string, handleOrder : Handler)=>{
  await ensureGroup(group); 
  const sub = redis.duplicate();

  const run = async(message :[string, string[]][])=>{
    for(const [id, field] of message){
      try{
         await handleOrder(toObject(field), id);
         await sub.xack(ORDERS_STREAM, group, id);
         
      }
      catch(e){console.error(`[${group}/${name}] failed ${id}`, e);}
    }
  };

  while(true){
      const res = (await sub.xreadgroup("GROUP", group, name, "COUNT", 10, "STREAMS", ORDERS_STREAM, "0")) as any;
      const msg = res?.[0]?.[1] ?? [];
      if (msg.length === 0) break;
      await run(msg);
  };

  while(true){
    const res = (await sub.xreadgroup("GROUP", group, name, "COUNT", 10, "BLOCK", 5000, "STREAMS", ORDERS_STREAM, ">")) as any;
      if(res?.[0])await run(res?.[0]?.[1]);
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redis.quit();
  process.exit(0);
});

const shutdown = async () => {
  await redis.quit();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);