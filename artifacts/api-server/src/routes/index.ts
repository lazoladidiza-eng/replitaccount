import { Router, type IRouter } from "express";
import acrRouter from "./acr";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(acrRouter);

export default router;
