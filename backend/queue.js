let queue = [];

export const addToQueue = (job) => {
  queue.push(job);
};

export const processQueue = async (handler) => {
  setInterval(async () => {
    if (queue.length === 0) return;

    const job = queue.shift();

    try {
      await handler(job);
    } catch (err) {
      console.error("Queue error:", err);
    }
  }, 1000);
};
