
import { Agent, RunContext, run, tool } from "@openai/agents";
import { z } from "zod";

interface UserInfo {
  name: string;
  uid: number;
}

const fetchUserAge = tool({
  name: "fetch_user_age",
  description: "Return the age of the current user.",
  parameters: z.object({}),
  async execute(_args, runContext?: RunContext<UserInfo>) {
    return `User ${runContext?.context.name} is 47 years old`;
  },
});

const agent = new Agent<UserInfo>({
  name: "Assistant",
  tools: [fetchUserAge],
});

const result = await run(agent, "What is the age of the user?", {
  context: { name: "John", uid: 123 },
});

console.log(result.finalOutput);

// The important boundary is:
//
// Conversation history is what the model sees.
// Run context is what your code sees.
// If the model needs a fact, put it in instructions, input,
// retrieval, or a tool. If only your runtime needs it, keep it in local context.
