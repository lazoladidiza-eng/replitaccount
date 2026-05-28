import { logger } from "./lib/logger";
import { runAllScrapers } from "./scrapers";

export async function runDailyPipeline(): Promise<void> {
  // TODO (in order):
  //   1. runAllScrapers() → store new circulars
  //   2. parseCircular() for each new circular → store posts
  //   3. scoreMatch() per (post, active CV profile)
  //   4. composeDigest() of top-N new matches
  //   5. sendDigest() to subscribed users
  const { circulars, errors } = await runAllScrapers();
  logger.info(
    { circulars: circulars.length, errors: errors.length },
    "daily pipeline tick (stub)",
  );
}

export function startScheduler(): void {
  // TODO: wire node-cron once installed. For now scheduling is manual via
  // POST /api/run (see routes/admin.ts).
  logger.info("scheduler disabled (stub)");
}
