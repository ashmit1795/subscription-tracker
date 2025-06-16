import { Client as WorkflowClient } from "@upstash/workflow";
import { QSTASH_URL, QSTASH_TOKEN } from "./env.js";

const workflowClient = new WorkflowClient({
    url: QSTASH_URL,
    token: QSTASH_TOKEN
});

export default workflowClient;
// This code initializes a WorkflowClient instance for Upstash with the provided QSTASH_URL and QSTASH_TOKEN.
