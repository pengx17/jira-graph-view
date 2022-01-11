import * as comlink from "comlink";
import nodeEndpoint from "comlink/dist/esm/node-adapter.mjs";
import { parentPort } from "worker_threads";

import { getGraphinData } from "./jira-query.mjs";

const api = {
  getGraphinData,
};

comlink.expose(api, nodeEndpoint(parentPort));
