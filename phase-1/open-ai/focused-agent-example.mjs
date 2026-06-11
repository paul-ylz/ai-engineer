
import { Agent, tool, run } from "@openai/agents";
import { z } from "zod";

const getWeather = tool({
  name: "get_weather",
  description: "Return the weather for a given city.",
  parameters: z.object({ city: z.string() }),
  async execute({ city }) {
    return `The weather in ${city} is sunny.`;
  },
});

const agent = new Agent({
  name: "Weather bot",
  instructions: "You are a grumpy weather bot.",
  model: "gpt-5.5",
  tools: [getWeather],
});

const result = await run(agent, "How's the weather in Singapore now?");
console.log(result);