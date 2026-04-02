# Agent Interaction Control: Next.js Checkout Demo

This is a demonstration of how to integrate the [@aicorg/sdk-react](https://www.npmjs.com/package/@aicorg/sdk-react) and [@aicorg/plugin-next](https://www.npmjs.com/package/@aicorg/plugin-next) into a complex, multi-step Next.js workflow with structured validation and semantic boundaries.

## Demo: Autonomous Agent Execution

This example proves that an AI agent using the standard MCP protocol can autonomously operate a Next.js web application utilizing AIC components, without brittle DOM selectors.

Here is a recording of an autonomous browser agent completing the full checkout flow (applying a coupon, saving the cart, and submitting the order):

![Next.js Checkout Agent E2E Validation](/C:/Users/vatsa/.gemini/antigravity/brain/26f18e3c-849e-46a7-a753-d0a5bbf996c4/nextjs_checkout_test_1775089024345.webp)

## Getting Started

1. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```

2. Generate the static `/public/.well-known` AIC manifests using the CLI toolkit:
   ```bash
   npx aic generate project aic.project.json --out-dir ./public
   ```

3. Start the Next.js development server:
   ```bash
   pnpm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Simulating the Agent Connection (MCP)

To verify the MCP Server integration against this Next.js app:

1. Keep the Next.js developer server running on `localhost:3000`.
2. In a new terminal within this directory, run the simulation script:
   ```bash
   node simulate-mcp-client.mjs
   ```
3. The script connects to the AIC MCP Server over `stdio` and lists actionable elements extracted directly from the generated static files.
