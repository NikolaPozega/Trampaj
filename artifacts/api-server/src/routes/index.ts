import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import escrowRouter from "./escrow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/escrow", escrowRouter);

export default router;
