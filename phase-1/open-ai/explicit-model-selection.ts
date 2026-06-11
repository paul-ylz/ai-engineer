
import { Agent, Runner } from "@openai/agents";

const fastAgent = new Agent({
  name: "Fast support agent",
  instructions: "Handle routine support questions.",
  model: "gpt-5.4-mini",
});

const generalAgent = new Agent({
  name: "General support agent",
  instructions: "Handle support questions carefully.",
});

const runner = new Runner({
  model: "gpt-5.5",
});

await runner.run(fastAgent, "Summarize ticket 123.");
const result = await runner.run(
  generalAgent,
  "Investigate the billing issue on account 456.",
);

console.log(result.finalOutput);
