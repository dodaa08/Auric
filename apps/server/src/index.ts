import express, { type Request, type Response } from "express";
const app = express();
import cors from "cors";
import dotenv from "dotenv";
import AppRouter from "./routes";
import {db} from "@repo/db";
import { redis } from "@repo/redis";
import { sql } from "drizzle-orm";
dotenv.config();

const port = process.env.PORT;

app.use(express.json());
app.use(AppRouter);

app.use(cors({
    origin : "*"
}));

app.get("/health", async (req : Request, res : Response)=>{
    try{
        const [dbres, redisres] = await Promise.allSettled([
            db.execute(sql`select 1`),
            redis.ping()
        ]);

        const checks = {
            db : dbres.status == "fulfilled" ? "ok" : "down",
            redis : redisres.status == "fulfilled" ? "ok" : "down"
        };

        const healthy = checks.db == "ok" && checks.redis == "ok";

        return res.status(healthy ? 200 : 500).json({
            status : healthy ? "ok" : "degraded",
            checks
        });

    }
    catch(e){
        console.error("list markets failed", e);
    return res.status(500).json({ error: "internal error" });
    }
});

app.listen(port, ()=>{
    console.log("Running on port", port);
});