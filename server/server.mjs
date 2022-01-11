import * as comlink from "comlink";
import nodeEndpoint from "comlink/dist/esm/node-adapter.mjs";
import fastify from "fastify";
import httpProxy from "fastify-http-proxy";
import staticPlugin from "fastify-static";
import * as fs from "fs";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";
import { log } from "./log.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { username, password } = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "./dev.config.json"), "utf8")
  );

  const app = fastify({ logger: log });

  const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString(
    "base64"
  )}`;

  /**
   * @type {Map<string, { ts: number, worker: Worker }>}
   */
  const workers = new Map();
  const getWorker = (sessionId) => {
    if (!workers.has(sessionId)) {
      log.info("Created new worker for " + sessionId);
      workers.set(sessionId, {
        worker: new Worker(path.resolve(__dirname, "./jira-query-worker.mjs"), {
          env: {
            authorization: basicAuth,
            worker_idx: sessionId,
          },
        }),
      });
    }
    workers.get(sessionId).ts = Date.now();
    return workers.get(sessionId).worker;
  };

  // Clear workers that are not used in the last 5 minutes
  setInterval(() => {
    for (const [sessionId, { ts, worker }] of workers) {
      if (Date.now() - ts > 1000 * 60 * 5) {
        log.info(`Worker [${sessionId}] is not used for 5 minutes, killing it`);
        worker.terminate();
        workers.delete(sessionId);
      }
    }
  }, 1000 * 30);

  app.register(httpProxy, {
    upstream: "https://jira.freewheel.tv",
    prefix: "/api/useravatar",
    rewritePrefix: "/secure/useravatar",
    preHandler: (req, res, next) => {
      // Will need this header, otherwise we will not see the avatar
      req.headers["Authorization"] = basicAuth;
      next();
    },
  });

  app.route({
    method: "GET",
    url: "/api/graphin-data",
    schema: {
      querystring: {
        focus: { type: "string" },
      },
    },
    handler: async (request) => {
      const sessionId = request.headers["x-session-id"];
      const worker = getWorker(sessionId);
      const dbAPI = comlink.wrap(nodeEndpoint(worker));
      const d = await dbAPI.getGraphinData(request.query.focus);
      return d;
    },
  });

  const publicPath = path.resolve(__dirname, "./public");
  // check if public folder exists
  if (fs.existsSync(path.resolve(__dirname, "./public"))) {
    app.register(staticPlugin, {
      root: publicPath,
      prefix: "/",
    });
  }

  try {
    await app.listen(12306, "0.0.0.0");
    app.log.info("started");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
