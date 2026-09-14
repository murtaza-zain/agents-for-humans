import { Agent } from '@strands-agents/sdk'
import { OpenAIModel } from '@strands-agents/sdk/models/openai'

const model = new OpenAIModel({
  modelId: 'openai.gpt-oss-120b',
  bedrockMantleConfig: {
    region: 'us-east-1',
  },
})

const agent = new Agent({
  model,
  systemPrompt:
    'Answer in one sentence. Confirm that you are running through Strands and Amazon Bedrock Mantle.',
})

const result = await agent.invoke('Run a connectivity test.')

console.log('\n=== MANTLE TEST ===\n')
console.log(result.lastMessage)
