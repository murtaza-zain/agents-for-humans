import { Agent } from '@strands-agents/sdk'
import { z } from 'zod'
import { workpilotModel } from '../models/workpilotModel.js'

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  expectedOutput: z.string(),
})

const workPlanSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  tasks: z.array(taskSchema).length(5),
})

export type WorkPlan = z.infer<typeof workPlanSchema>

const planner = new Agent({
  name: 'WorkPilot Planner',
  description:
    'Creates a compact five-stage workflow plan for a professional job.',
  model: workpilotModel,
  systemPrompt: `
You are the WorkPilot planning engine.

Your ONLY job is to design a five-stage workflow.

Do NOT write the final answer to the user's job.

Do NOT perform the research.

Do NOT write the competitive report.

Return ONLY a compact planning table using exactly this format:

| # | Task | What needs to be done | Expected output |
|---|------|------------------------|-----------------|
| 1 | ... | ... | ... |
| 2 | ... | ... | ... |
| 3 | ... | ... | ... |
| 4 | ... | ... | ... |
| 5 | ... | ... | ... |

Rules:
- Exactly five rows.
- Each row represents one workflow stage.
- Keep titles under 12 words.
- Keep descriptions under 40 words.
- Keep expected outputs under 25 words.
- Do not include owners.
- Do not include timelines.
- Do not include RACI.
- Do not include SWOT unless it is genuinely needed for the user's goal.
- Do not write an executive report.
- Do not provide a source list.
- Do not provide recommendations.
- Do not produce anything outside the table.
`,
})

function extractText(result: unknown): string {
  if (
    result &&
    typeof result === 'object' &&
    'lastMessage' in result
  ) {
    const lastMessage = (
      result as {
        lastMessage?: {
          content?: unknown
        }
      }
    ).lastMessage

    if (
      lastMessage &&
      Array.isArray(lastMessage.content)
    ) {
      return lastMessage.content
        .map((block) => {
          if (typeof block === 'string') {
            return block
          }

          if (
            block &&
            typeof block === 'object' &&
            'text' in block &&
            typeof block.text === 'string'
          ) {
            return block.text
          }

          return ''
        })
        .join('\n')
        .trim()
    }
  }

  return String(result)
}

function extractPlanningTable(
  text: string,
): Array<{
  number: string
  title: string
  description: string
  expectedOutput: string
}> {
  const lines = text.split('\n')

  const rows: Array<{
    number: string
    title: string
    description: string
    expectedOutput: string
  }> = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!/^\|\s*\d+\s*\|/.test(trimmed)) {
      continue
    }

    const cells = trimmed
      .split('|')
      .map((cell) =>
        cell
          .replace(/\*\*/g, '')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean)

    if (cells.length < 4) {
      continue
    }

    const number = cells[0]

    if (!/^[1-5]$/.test(number)) {
      continue
    }

    rows.push({
      number,
      title: cells[1],
      description: cells[2],
      expectedOutput: cells[3],
    })
  }

  return rows.slice(0, 5)
}

function createDeterministicFallback(
  goal: string,
): WorkPlan {
  const researchGoal = goal.trim()

  return workPlanSchema.parse({
    goal: researchGoal,
    summary:
      'Five-stage professional research and decision workflow.',
    tasks: [
      {
        id: 'task-1',
        title: 'Define scope and research criteria',
        description:
          'Clarify the desired decision, comparison criteria, evidence requirements, and important uncertainties.',
        dependencies: [],
        expectedOutput:
          'A clear research scope and evaluation framework.',
      },
      {
        id: 'task-2',
        title: 'Collect and validate evidence',
        description:
          'Research authoritative sources and gather current evidence relevant to the user’s requested outcome.',
        dependencies: ['task-1'],
        expectedOutput:
          'A validated evidence base with source URLs.',
      },
      {
        id: 'task-3',
        title: 'Analyse findings and tradeoffs',
        description:
          'Compare the evidence, identify differences, strengths, weaknesses, risks, and meaningful uncertainties.',
        dependencies: ['task-2'],
        expectedOutput:
          'A comparative analysis with key findings and tradeoffs.',
      },
      {
        id: 'task-4',
        title: 'Build the decision-ready draft',
        description:
          'Turn the validated analysis into a concise draft tailored to the user’s decision and requested output.',
        dependencies: ['task-3'],
        expectedOutput:
          'A decision-ready draft with evidence and recommendations.',
      },
      {
        id: 'task-5',
        title: 'Quality-check and finalize',
        description:
          'Verify completeness, evidence quality, uncertainty, source traceability, and alignment with the original goal.',
        dependencies: ['task-4'],
        expectedOutput:
          'A verified final answer ready for the user.',
      },
    ],
  })
}

export async function createWorkPlan(
  goal: string,
): Promise<WorkPlan> {
  const result = await planner.invoke(`
Create the five-stage workflow for this job:

${goal}

Remember:
- planning only
- exactly five rows
- table only
- no final answer
`)

  const rawText = extractText(result)
  const rows = extractPlanningTable(rawText)

  if (rows.length !== 5) {
    return createDeterministicFallback(goal)
  }

  const plan = workPlanSchema.safeParse({
    goal,
    summary:
      'Five-stage workflow generated by WorkPilot.',
    tasks: rows.map((row, index) => ({
      id: `task-${index + 1}`,
      title: row.title,
      description: row.description,
      dependencies:
        index === 0
          ? []
          : [`task-${index}`],
      expectedOutput: row.expectedOutput,
    })),
  })

  if (!plan.success) {
    return createDeterministicFallback(goal)
  }

  return plan.data
}
