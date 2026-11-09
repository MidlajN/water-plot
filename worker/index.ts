import "dotenv/config";
import { startPlotTracking } from "./plotterSender";
import { startScheduler } from "./scheduler";

console.log("[Worker] Plotter Studio worker starting...");

startPlotTracking();

startScheduler().catch((error) => {
    console.error("[Worker] Fatal error:", error);
    process.exit(1);
});