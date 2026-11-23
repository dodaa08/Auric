import express from "express";
const AppRouter = express.Router();

import orderR from "./orders/routes";
import MM from "./MM/route";


AppRouter.use("/api/v1/orders", orderR);
AppRouter.use("/api/v1/mm", MM);

export default AppRouter;