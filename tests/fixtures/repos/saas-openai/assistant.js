const OpenAI = require('openai');

const client = new OpenAI();

async function chat(userMessage) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: userMessage }
    ],
    stream: true
  });

  let fullResponse = '';
  for await (const chunk of response) {
    const delta = chunk.choices[0]?.delta?.content || '';
    fullResponse += delta;
    process.stdout.write(delta);
  }

  return fullResponse;
}

async function embed(text) {
  const response = await client.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  });
  return response.data[0].embedding;
}

module.exports = { chat, embed };
