import { createWorkPlan } from './planner.js'

const goal = `
Compare Stripe, Adyen, and Paddle and create a decision-ready
competitive intelligence brief covering products, pricing, target
customers, major features, positioning, strengths, and weaknesses.
`

const main = async () => {
  try {
    const plan = await createWorkPlan(goal)

    console.log('\n=== WORKPILOT PLAN ===\n')
    console.log(JSON.stringify(plan, null, 2))
  } catch (error) {
    console.error('\n=== PLANNER ERROR ===\n')
    console.error(error)
    process.exit(1)
  }
}

await main()
