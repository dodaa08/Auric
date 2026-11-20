import express from "express";
const app = express();
import cors from "cors";
import dotenv from "dotenv";
import AppRouter from "./routes";
dotenv.config();

const port = process.env.PORT;

app.use(express.json());
app.use(AppRouter);

app.use(cors({
    origin : "*"
}));

app.get("/health", (req, res)=>{
    res.status(200).send("health all good")
});

app.listen(port, ()=>{
    console.log("Running on port", port);
});