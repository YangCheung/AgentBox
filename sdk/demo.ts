import { readFileSync } from "node:fs";
import {
  AgentBox,
  isTextContent,
  isTextDelta,
  type ContentBlockDeltaEvent,
} from "./src/index.js";

// Load .env file (simple parser, no dependencies)
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const i = trimmed.indexOf("=");
  if (i > 0) {
    const key = trimmed.slice(0, i).trim();
    const val = trimmed.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// Collect all LLM-related env vars for the container
const LLM_PREFIXES = ["ANTHROPIC_", "API_", "CLAUDE_", "MODEL"];
const env: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && LLM_PREFIXES.some((p) => k.startsWith(p))) {
    env[k] = v;
  }
}

const agent = await AgentBox.create({
  agentServer: process.env.AGENTBOX_SERVER!,
  token: process.env.AGENTBOX_TOKEN!,
  task: "You are a helpful coding assistant.",
  env,
});

console.log(`Container created: ${agent.id}`);

try {
  for await (const msg of agent.query(
    "What is 2+2? Answer briefly. explain detail",
    { max_turns: 5, include_partial_messages: true },
  )) {
    switch (msg.type) {
      case "stream_event": {
        const evt = msg.event;
        if (evt.type === "content_block_delta") {
          const delta = (evt as ContentBlockDeltaEvent).delta;
          if (isTextDelta(delta)) {
            process.stdout.write(delta.text);
          }
        }
        break;
      }
      case "result":
        console.log(
          `\n\nDone in ${msg.duration_ms}ms, cost $${msg.total_cost_usd ?? "??"}`,
        );
        break;
    }
  }
} finally {
  await agent.delete();
  console.log("Container deleted.");
}
