import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import escrowRouter from "./escrow";
import paymentsRouter from "./payments";
import sendcloudRouter from "./sendcloud";
import listingsRouter from "./listings";
import conversationsRouter from "./conversations";
import reviewsRouter from "./reviews";
import blockedRouter from "./blocked";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/escrow", escrowRouter);
router.use("/payments", paymentsRouter);
router.use("/sendcloud", sendcloudRouter);
router.use(listingsRouter);
router.use(conversationsRouter);
router.use(reviewsRouter);
router.use(blockedRouter);

export default router;
