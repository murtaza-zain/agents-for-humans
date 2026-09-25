# WorkPilot — Give AI the Job, Not the Prompt

WorkPilot is a professional AI agent that turns a high-level business objective into an executable workflow instead of requiring the user to engineer a complex prompt.

The core idea is simple:

> Give AI the job, not the prompt.

## The Problem

Professional research tasks require more than generating a single response.

A useful workflow may involve:

Goal → Scope → Research → Evidence → Analysis → Human Review → Synthesis → Quality Check

The human should not have to manually design every prompt and coordinate every step.

## What WorkPilot Does

WorkPilot accepts a high-level business objective and turns it into an executable workflow.

Example job:

Research Stripe, Adyen, and Paddle and produce a competitive-intelligence brief comparing their products, pricing, target customers, features, positioning, strengths, weaknesses, and the best fit for different business situations.

The agent workflow:

1. Defines the research scope.
2. Plans executable tasks.
3. Performs live web research.
4. Prefers primary sources when gathering evidence.
5. Tracks evidence and uncertainty.
6. Analyses findings and trade-offs.
7. Identifies situations where human judgement is valuable.
8. Stops at a human approval gate.
9. Continues only after human approval.
10. Produces a structured final report.
11. Runs quality checks before completion.

## Human-in-the-Loop

WorkPilot is deliberately not a fully autonomous black box.

At the human approval stage, the human can:

- Approve and continue
- Reject and stop

This provides a deliberate control point between agent execution and consequential output.

## Architecture

User Job
↓
Scope
↓
Planning
↓
Live Research
↓
Evidence & Uncertainty
↓
Analysis
↓
Human Approval
↓
Synthesis
↓
Quality Check
↓
Final Result

The workflow is implemented as an explicit stateful agent system so that planning, execution, evidence handling, human approval, synthesis, and quality validation remain separate phases.

## AWS

WorkPilot is built around:

- AWS Strands Agents
- AWS Bedrock Mantle
- TypeScript
- Node.js

The Strands Agents SDK is used as the agent orchestration layer, while Bedrock Mantle provides model access.

## Project Structure

    agents-for-humans/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── agent/
    │   ├── events/
    │   ├── models/
    │   ├── research/
    │   ├── state/
    │   ├── tools/
    │   ├── demoServer.ts
    │   └── ...
    ├── .env.example
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    └── tsconfig.json

## Running Locally

### Requirements

- Node.js
- An AWS account with access to the configured model
- AWS credentials configured locally

### Install dependencies

    npm install

### Configure AWS credentials

Use the AWS authentication method appropriate for your environment.

For AWS SSO, for example:

    aws sso login --profile YOUR_AWS_PROFILE
    export AWS_PROFILE=YOUR_AWS_PROFILE
    export AWS_REGION=us-east-1

### Start the demo

    npm run demo

Then open:

    http://localhost:3000

Click Start WorkPilot to execute the workflow.

## Workflow Demonstration

The demonstration runs through:

Scope → Research → Analysis → Human Approval → Synthesis → Quality

At the human approval stage, choose Approve and continue to complete the workflow.

The rejection path can also be exercised to demonstrate that the agent stops when approval is denied.

## Design Principles

WorkPilot separates:

- Planning from execution
- Research from analysis
- Evidence from conclusions
- Machine execution from human approval
- Generation from quality validation

This structure is intended to make professional agent workflows more controllable and reusable.

## Hackathon

WorkPilot was built for the Agents for Humans Hackathon.

The project explores a shift from prompt engineering toward delegated professional work:

"Here is a prompt. Figure it out."

becomes:

"Here is the job. Execute the workflow."

## License

WorkPilot is released under the MIT License.
