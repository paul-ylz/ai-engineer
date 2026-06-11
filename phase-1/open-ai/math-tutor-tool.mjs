import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
    model: "gpt-5.5",
    instructions: "You are a personal math tutor. When asked a math question, write and run code to answer the question.",
    tools: [
        {
            type: "code_interpreter",
            container: { type: "auto" },
        },
    ],
    input: "I need to solve the equation 3x + 11 = 14. Can you help me?",
});

console.log(response.output_text);

