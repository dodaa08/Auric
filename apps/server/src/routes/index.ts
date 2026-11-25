import express from "express";
const AppRouter = express.Router();

import orderR from "./orders/routes";
import MM from "./MM/route";
import marketR from "./market/route";

// Todo Adding real auth, middlewares and userIds to the routes dynamically in orders and mms and add balances and user routes
AppRouter.use("/api/v1/orders", orderR);
AppRouter.use("/api/v1/mm", MM);
AppRouter.use("/api/v1/markets", marketR);
// AppRouter.use("/api/v1/balances");
// AppRouter.use("/api/v1/user");

export default AppRouter;