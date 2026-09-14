import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { runWorkPilot } from './agent/workpilotRunner.js'

const goal = `
Compare Stripe, Adyen, and Paddle and create a decision-ready
competitive intelligence brief covering:

- products
- pricing
- target customers
- major features
- positioning
- strengths
- weaknesses

Use real web research.

Prefer official or primary sources.

Be careful with pricing because pricing may vary by
country, payment method, volume, and contract.

The final result should clearly explain which provider
is strongest for different business situations.
`

console.log('\n========================================')
console.log('        WORKPILOT END-TO-END TEST')
console.log('========================================\n')

const rl = readline.createInterface({
  input,
  output,
})

try {
  const result = await runWorkPilot(goal, {
    approvalHandler: async (request) => {
      console.log('\n========================================')
      console.log('        HUMAN APPROVAL REQUIRED')
      console.log('========================================\n')

      console.log('REASON:')
      console.log(request.reason)

      console.log('\nCONTEXT:')
      console.log(request.context)

      console.log('\nRECOMMENDATION:')
      console.log(request.recommendation)

      console.log('\nOPTIONS:')
      console.log('1 = Approve and continue')
      console.log('2 = Reject and stop')

      const answer = await rl.question(
        '\nEnter 1 to approve or 2 to reject: ',
      )

      return answer.trim() === '1'
    },
  })

  console.log('\n========================================')
  console.log('              PLAN')
  console.log('========================================\n')

  console.log(
    JSON.stringify(result.plan, null, 2),
  )

  console.log('\n========================================')
  console.log('             APPROVALS')
  console.log('========================================\n')

  console.log(
    JSON.stringify(result.approvals, null, 2),
  )

  console.log('\n========================================')
  console.log('              EVENTS')
  console.log('========================================\n')

  for (const event of result.events) {
    console.log(
      `[${event.type}] ${event.message}`,
    )
  }

  console.log('\n========================================')
  console.log('          QUALITY REPORT')
  console.log('========================================\n')

  console.log(
    JSON.stringify(result.quality, null, 2),
  )

  console.log('\n========================================')
  console.log('             FINAL REPORT')
  console.log('========================================\n')

  console.log(result.finalReport)
} catch (error) {
  console.error('\n========================================')
  console.error('              RUN FAILED')
  console.error('========================================\n')
  console.error(error)
  process.exitCode = 1
} finally {
  rl.close()
}
