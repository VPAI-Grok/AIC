# QA Agent Readiness Sample

This sample shows the expected shape of a pilot handoff report for the Vite CRM example after running:

```bash
pnpm --dir examples/react-basic run aic:generate
pnpm --dir examples/react-basic run aic:qa-readiness
pnpm --dir examples/react-basic run aic:qa-plan
```

## Readiness Summary

- App: AIC CRM Demo
- Framework: Vite
- Pilot workflow: Archive Customer
- High/critical actions: `customer.archive`
- Confirmation coverage: `customer.archive` is intentionally flagged until structured confirmation metadata is added to the generated runtime element
- Workflow coverage: generated workflows include `customer.archive`
- QA plan source: generated workflows

## Expected Findings

The example is suitable as a demo of the paid-pilot workflow, but a real customer pilot should review any warnings about:

- missing structured confirmation metadata on high-risk actions
- missing entity metadata on record-scoped actions
- missing execution, validation, or recovery metadata where the app already exposes those semantics
- extraction diagnostics from unsupported dynamic `agent*` expressions

## Generated QA Scenario Shape

```json
{
  "artifact_type": "aic_qa_test_plan",
  "source": "workflows",
  "scenarios": [
    {
      "id": "customer.archive",
      "title": "Archive Customer",
      "max_risk": "high",
      "safety_path": true,
      "steps": [
        {
          "target": "customer.archive.dialog.open",
          "action": "click",
          "requires_confirmation": false
        },
        {
          "target": "customer.archive",
          "action": "submit",
          "requires_confirmation": true
        }
      ]
    }
  ]
}
```

The generated Playwright skeleton should use `data-agent-id` as the contract key, not button text or layout selectors.
