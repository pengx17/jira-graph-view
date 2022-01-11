import { isMainThread } from "worker_threads";
import pino from "pino";

export const log = pino({
  name: isMainThread ? "main: " : `wid(${process.env.worker_idx}):`,
  transport: {
    target: "pino-pretty",
  },
  level: "info",
});
