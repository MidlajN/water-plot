import "dotenv/config";
import { startScheduler } from "./scheduler";

console.log("[Worker] Plotter Studio worker starting...");

startScheduler().catch((error) => {
    console.error("[Worker] Fatal error:", error);
    process.exit(1);
});