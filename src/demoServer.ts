import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  runWorkPilot,
  type WorkPilotApprovalRequest,
} from './agent/workpilotRunner.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')
const publicDir = join(__dirname, '..', 'public')
const PORT = Number(process.env.PORT || 3000)

type DemoStatus =
  | 'idle'
  | 'running'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'

type DemoState = {
  status: DemoStatus
  startedAt?: string
  completedAt?: string
  approval?: WorkPilotApprovalRequest
  approvalDecision?: 'approved' | 'rejected'
  quality?: {
    passed: boolean
    score: number
    issues: string[]
  }
  finalReport?: string
  error?: string
}

const state: DemoState = {
  status: 'idle',
}

let approvalResolver:
  | ((approved: boolean) => void)
  | undefined

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })

  response.end(JSON.stringify(payload))
}

async function startWorkPilot() {
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

  state.status = 'running'
  state.startedAt = new Date().toISOString()
  state.completedAt = undefined
  state.approval = undefined
  state.approvalDecision = undefined
  state.quality = undefined
  state.finalReport = undefined
  state.error = undefined

  try {
    const result = await runWorkPilot(goal, {
      approvalHandler: async (request) => {
        state.status = 'waiting_for_approval'
        state.approval = request

        return await new Promise<boolean>((resolve) => {
          approvalResolver = resolve
        })
      },
    })

    state.status = 'completed'
    state.completedAt = new Date().toISOString()
    state.quality = result.quality
    state.finalReport = result.finalReport
  } catch (error) {
    state.status = 'failed'
    state.completedAt = new Date().toISOString()
    state.error =
      error instanceof Error ? error.message : String(error)
  }
}

async function serveFile(
  requestPath: string,
  response: ServerResponse,
) {
  const relativePath =
    requestPath === '/'
      ? 'index.html'
      : requestPath.replace(/^\/+/, '')

  const filePath = join(publicDir, relativePath)

  try {
    const content = await readFile(filePath)
    const extension = extname(filePath)

    const types: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
    }

    response.writeHead(200, {
      'Content-Type':
        types[extension] || 'application/octet-stream',
    })

    response.end(content)
  } catch {
    sendJson(response, 404, {
      error: 'Not found',
    })
  }
}

const server = createServer(
  async (
    request: IncomingMessage,
    response: ServerResponse,
  ) => {
    try {
      const method = request.method || 'GET'
      const url = new URL(
        request.url || '/',
        `http://${request.headers.host || 'localhost'}`,
      )

      if (
        method === 'GET' &&
        url.pathname === '/api/status'
      ) {
        sendJson(response, 200, state)
        return
      }

      if (
        method === 'POST' &&
        url.pathname === '/api/start'
      ) {
        if (
          state.status === 'running' ||
          state.status === 'waiting_for_approval'
        ) {
          sendJson(response, 409, {
            error: 'A WorkPilot job is already running.',
          })
          return
        }

        void startWorkPilot()

        sendJson(response, 202, {
          status: 'started',
        })
        return
      }

      if (
        method === 'POST' &&
        url.pathname === '/api/approve'
      ) {
        if (
          state.status !== 'waiting_for_approval' ||
          !approvalResolver
        ) {
          sendJson(response, 409, {
            error: 'No approval is currently pending.',
          })
          return
        }

        const resolve = approvalResolver
        approvalResolver = undefined

        state.approvalDecision = 'approved'
        state.approval = state.approval
          ? {
              ...state.approval,
              status: 'approved',
              resolvedAt: new Date().toISOString(),
            }
          : undefined

        state.status = 'running'
        resolve(true)

        sendJson(response, 200, {
          status: 'approved',
        })
        return
      }

      if (
        method === 'POST' &&
        url.pathname === '/api/reject'
      ) {
        if (
          state.status !== 'waiting_for_approval' ||
          !approvalResolver
        ) {
          sendJson(response, 409, {
            error: 'No approval is currently pending.',
          })
          return
        }

        const resolve = approvalResolver
        approvalResolver = undefined

        state.approvalDecision = 'rejected'
        state.approval = state.approval
          ? {
              ...state.approval,
              status: 'rejected',
              resolvedAt: new Date().toISOString(),
            }
          : undefined

        state.status = 'running'
        resolve(false)

        sendJson(response, 200, {
          status: 'rejected',
        })
        return
      }

      if (method === 'GET') {
        await serveFile(url.pathname, response)
        return
      }

      sendJson(response, 405, {
        error: 'Method not allowed.',
      })
    } catch (error) {
      sendJson(response, 500, {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      })
    }
  },
)

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('========================================')
  console.log('        WORKPILOT DEMO SERVER')
  console.log('========================================')
  console.log('')
  console.log(`Open: http://localhost:${PORT}`)
  console.log('')
})
