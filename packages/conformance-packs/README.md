# `@aicorg/conformance-packs`

This package contains open, protocol-neutral conformance profiles for consequential application operations. A profile states structural obligations for requirements, scenarios, surface roles, outcomes, confirmation, forbidden side effects, and parity.

Profiles never infer semantic mappings. An application author must explicitly bind each pack obligation to reviewed behavior-contract requirements, scenarios, and surfaces. A passed result proves that those authored bindings are structurally satisfied; it does not prove that prose descriptions are truthful, that every material risk was modeled, or that a deployment is independently certified.

Built-in pack IDs:

- `aic.pack.checkout`
- `aic.pack.billing-mutation`
- `aic.pack.account-deletion`
- `aic.pack.admin-mutation`
- `aic.pack.record-crud`

`record-crud` contains separate `create`, `read`, `update`, and `delete` profiles because one AIC behavior contract describes one domain operation.
