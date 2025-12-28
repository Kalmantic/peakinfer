import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function runAgent(query: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 1024,
    messages: [{ role: "user", content: query }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function streamResponse(query: string): AsyncGenerator<string> {
  const stream = await client.messages.stream({
    model: "claude-3-opus-20240229",
    max_tokens: 4096,
    messages: [{ role: "user", content: query }],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta") {
      yield chunk.delta.text;
    }
  }
}
