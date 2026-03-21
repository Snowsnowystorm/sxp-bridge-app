import { processQueue } from "./queue.js";
import { sendToken } from "./wallet.js";

export const startWorker = () => {
  console.log("⚡ Worker started...");

  processQueue(async (job) => {
    if (job.type === "withdraw") {
      const txHash = await sendToken(job.address, job.amount);
      console.log("💸 Worker processed withdraw:", txHash);
    }
  });
};
