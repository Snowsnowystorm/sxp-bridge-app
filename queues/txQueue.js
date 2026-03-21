import { Queue } from "bullmq";
import { redis } from "../utils/redis.js";

export const txQueue = new Queue("transactions", {
  connection: redis
});
