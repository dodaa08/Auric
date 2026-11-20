import express from "express";
const AppRouter = express.Router();

import orderR from "./orders/routes";


AppRouter.use("/api/v1/orders", orderR);

export default AppRouter;