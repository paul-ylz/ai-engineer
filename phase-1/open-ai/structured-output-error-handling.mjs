try {
  const response = await openai.responses.create({
    model: "gpt-4o-2024-08-06",
    input: [{
        role: "system",
        content: "You are a helpful math tutor. Guide the user through the solution step by step.",
      },
      {
        role: "user",
        content: "how can I solve 8x + 7 = -23"
      },
    ],
    max_output_tokens: 50,
    text: {
      format: {
        type: "json_schema",
        name: "math_response",
        schema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  explanation: {
                    type: "string"
                  },
                  output: {
                    type: "string"
                  },
                },
                required: ["explanation", "output"],
                additionalProperties: false,
              },
            },
            final_answer: {
              type: "string"
            },
          },
          required: ["steps", "final_answer"],
          additionalProperties: false,
        },
        strict: true,
      },
    }
  });

  if (response.status === "incomplete" && response.incomplete_details.reason === "max_output_tokens") {
    // Handle the case where the model did not return a complete response
    throw new Error("Incomplete response");
  }

  const math_response = response.output[0].content[0];

  if (math_response.type === "refusal") {
    // handle refusal
    console.log(math_response.refusal);
  } else if (math_response.type === "output_text") {
    console.log(math_response.text);
  } else {
    throw new Error("No response content");
  }
} catch (e) {
  // Handle edge cases
  console.error(e);
}
