import { runWorkPilotJob } from './agent.js'

const job = `
Act as a professional competitive-intelligence analyst.

Compare Stripe, Adyen, and Paddle for a company evaluating payment infrastructure.

Research and produce a decision-ready brief covering:

- products
- pricing
- target customers
- major features
- positioning
- strengths
- weaknesses

Use real web sources.

Prefer official company sources.

For each competitor, identify at least two useful sources where possible.

Do not invent pricing.

Call out important uncertainty or areas where pricing depends on contract or geography.

End with a practical recommendation describing the type of business or use case for which each provider appears to be the strongest fit.
`

console.log('\n=== WORKPILOT JOB STARTED ===\n')

try {
  const result = await runWorkPilotJob(job)

  console.log('\n=== WORKPILOT RESULT ===\n')
  console.log(result.lastMessage)
} catch (error) {
  console.error('\n=== WORKPILOT ERROR ===\n')
  console.error(error)
  process.exitCode = 1
}
