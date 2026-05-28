import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/cv", (_req, res) => {
  // TODO: multer multipart upload → parseCv() → persist active CvProfile
  // per user. For now this is a placeholder so the route surface exists.
  res.status(501).json({
    error: "Not implemented",
    details: "CV upload pipeline is scaffolded but not wired yet.",
  });
});

router.get("/cv", (_req, res) => {
  // TODO: return the stored CvProfile for the authenticated user.
  res.status(501).json({ error: "Not implemented" });
});

export default router;
