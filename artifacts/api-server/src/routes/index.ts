import { Router, type IRouter } from "express";
import acrRouter from "./acr";
import audioRouter from "./audio";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(acrRouter);
router.use(audioRouter);

export default router;
