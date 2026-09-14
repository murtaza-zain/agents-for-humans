import { OpenAIModel } from '@strands-agents/sdk/models/openai'

export const workpilotModel = new OpenAIModel({
  modelId: 'openai.gpt-oss-120b',
  bedrockMantleConfig: {
    region: 'us-east-1',
  },
  maxTokens: 3000,
  temperature: 0,
})

