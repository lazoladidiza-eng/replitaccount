import { Router, type IRouter } from "express";
import { runDailyPipeline } from "../scheduler";

const router: IRouter = Router();

router.post("/run", async (req, res) => {
  try {
    await runDailyPipeline();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "manual pipeline run failed");
    res.status(500).json({
      error: "Pipeline run failed",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
