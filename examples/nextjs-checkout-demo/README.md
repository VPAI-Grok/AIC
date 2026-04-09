# Agent Interaction Control: Next.js Checkout Demo

This is a demonstration of how to integrate the [@aicorg/sdk-react](https://www.npmjs.com/package/@aicorg/sdk-react) and [@aicorg/plugin-next](https://www.npmjs.com/package/@aicorg/plugin-next) into a complex, multi-step Next.js workflow with structured validation and semantic boundaries.

## Demo: Autonomous Agent Execution

This example proves that an AI agent using the standard MCP protocol can autonomously operate a Next.js web application utilizing AIC components, without brittle DOM selectors.

Here is the repo's canonical Next.js AIC starter. It demonstrates generated manifests, MCP discovery, and a critical-action contract with structured confirmation.

If you are adopting AIC into an existing app instead of exploring this starter, use [Adopt AIC In An Existing App](/mnt/c/users/vatsa/agentinteractioncontrol/docs/adopt-existing-app.md).

## Getting Started

1. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```

2. Generate the AIC manifests using the local CLI toolkit:
   ```bash
   pnpm run aic:generate
   ```

3. Audit the example:
   ```bash
   pnpm run aic:doctor
   ```

4. Start the Next.js development server:
   ```bash
   pnpm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Simulating MCP Tool Usage

To verify the MCP integration layer against this Next.js app:

1. Keep the Next.js developer server running on `localhost:3000`.
2. In a new terminal within this directory, run the simulation script:
   ```bash
   node simulate-mcp-client.mjs
   ```
3. The script calls the same MCP tool handlers shipped in `@aicorg/mcp-server` against the running app and writes the result bundle to `mcp-simulation-result.json`.

For a real stdio MCP server validation, use the repo-level smoke command from the root:

```bash
pnpm smoke:mcp:stdio
```

You can override the target with:

```bash
AIC_BASE_URL=http://localhost:3000 node simulate-mcp-client.mjs
```

## Useful Commands

```bash
pnpm aic --help
pnpm run aic:doctor
pnpm run aic:generate
pnpm run aic:inspect
```
