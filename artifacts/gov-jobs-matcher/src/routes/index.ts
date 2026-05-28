import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cvRouter from "./cv";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cvRouter);
router.use(adminRouter);

export default router;
