import type {
  AICConformancePack,
  AICConformanceProfile
} from "@aicorg/spec";

const AIC_CONFORMANCE_SPEC = "aic.conformance/0.1";

interface MutationProfileInput {
  descriptions: {
    audit: string;
    authorizationAllowed: string;
    authorizationDenied: string;
    confirmationAccepted: string;
    confirmationDeclined: string;
    exactScope: string;
    failureIsolation: string;
    idempotency: string;
    mutation: string;
    recovery: string;
    unchanged: string;
  };
  description: string;
  id: string;
  title: string;
}

function createMutationProfile(input: MutationProfileInput): AICConformanceProfile {
  return {
    description: input.description,
    id: input.id,
    required_scenario_classes: [
      "success",
      "authorization_denial",
      "confirmation_decline",
      "business_failure",
      "recovery"
    ],
    requirements: [
      {
        description: input.descriptions.exactScope,
        id: "exact_scope",
        minimum_bindings: 1,
        phase: "precondition"
      },
      {
        description: input.descriptions.authorizationAllowed,
        id: "authorization_allowed",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: input.descriptions.authorizationDenied,
        id: "authorization_denied",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: input.descriptions.confirmationAccepted,
        id: "confirmation_accepted",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: input.descriptions.confirmationDeclined,
        id: "confirmation_declined",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: input.descriptions.idempotency,
        id: "idempotency",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: input.descriptions.failureIsolation,
        id: "failure_isolation",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: input.descriptions.mutation,
        id: "mutation_committed",
        minimum_bindings: 1,
        phase: "side_effect"
      },
      {
        description: input.descriptions.audit,
        id: "audit_evidence",
        minimum_bindings: 1,
        phase: "postcondition"
      },
      {
        description: input.descriptions.unchanged,
        id: "unchanged_when_stopped",
        minimum_bindings: 1,
        phase: "postcondition"
      },
      {
        description: input.descriptions.recovery,
        id: "safe_recovery",
        minimum_bindings: 1,
        phase: "recovery"
      }
    ],
    scenarios: [
      {
        allowed_confirmations: ["accepted"],
        allowed_statuses: ["succeeded"],
        class: "success",
        forbidden_requirement_refs: [
          "authorization_denied",
          "confirmation_declined",
          "unchanged_when_stopped"
        ],
        id: "success",
        parity: "required",
        requirement_refs: [
          "exact_scope",
          "authorization_allowed",
          "confirmation_accepted",
          "idempotency",
          "mutation_committed",
          "audit_evidence"
        ],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["not_reached"],
        allowed_statuses: ["denied"],
        class: "authorization_denial",
        forbidden_requirement_refs: [
          "authorization_allowed",
          "confirmation_accepted",
          "confirmation_declined",
          "mutation_committed",
          "audit_evidence"
        ],
        id: "authorization_denial",
        parity: "required",
        requirement_refs: ["exact_scope", "authorization_denied", "unchanged_when_stopped"],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["declined"],
        allowed_statuses: ["cancelled"],
        class: "confirmation_decline",
        forbidden_requirement_refs: [
          "authorization_denied",
          "confirmation_accepted",
          "mutation_committed",
          "audit_evidence"
        ],
        id: "confirmation_decline",
        parity: "required",
        requirement_refs: [
          "exact_scope",
          "authorization_allowed",
          "confirmation_declined",
          "unchanged_when_stopped"
        ],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["accepted"],
        allowed_statuses: ["failed"],
        class: "business_failure",
        forbidden_requirement_refs: [
          "authorization_denied",
          "confirmation_declined",
          "mutation_committed",
          "audit_evidence"
        ],
        id: "business_failure",
        parity: "required",
        requirement_refs: [
          "exact_scope",
          "authorization_allowed",
          "confirmation_accepted",
          "failure_isolation",
          "unchanged_when_stopped"
        ],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["accepted"],
        allowed_statuses: ["recovered"],
        class: "recovery",
        forbidden_requirement_refs: [
          "authorization_denied",
          "confirmation_declined",
          "unchanged_when_stopped"
        ],
        id: "recovery",
        parity: "required",
        requirement_refs: [
          "exact_scope",
          "authorization_allowed",
          "confirmation_accepted",
          "idempotency",
          "safe_recovery",
          "mutation_committed",
          "audit_evidence"
        ],
        surface_roles: ["human", "agent"]
      }
    ],
    title: input.title
  };
}

function createPack(input: Omit<AICConformancePack, "artifact_type" | "spec" | "version">): AICConformancePack {
  return {
    artifact_type: "aic_conformance_pack",
    ...input,
    spec: AIC_CONFORMANCE_SPEC,
    version: "0.1.0"
  };
}

const checkoutPack = createPack({
  description: "Assurance obligations for charging an order and completing checkout across human and agent surfaces.",
  id: "aic.pack.checkout",
  profiles: [
    createMutationProfile({
      descriptions: {
        audit: "Successful checkout produces durable order and payment evidence.",
        authorizationAllowed: "An authorized caller is allowed to continue to exact-charge confirmation.",
        authorizationDenied: "An unauthorized caller is denied before confirmation or payment execution.",
        confirmationAccepted: "The caller accepts the exact order and charge confirmation before execution.",
        confirmationDeclined: "A declined exact-charge confirmation stops execution.",
        exactScope: "The operation is bound to the intended order, amount, currency, and payment method.",
        failureIsolation: "A provider or business failure cannot leave an ambiguous or duplicate charge.",
        idempotency: "Repeated delivery cannot create more than one payment charge or order submission.",
        mutation: "Exactly one payment charge is committed and the exact order becomes submitted.",
        recovery: "A failed or interrupted checkout has an explicit safe reconciliation or retry path.",
        unchanged: "Authorization denial, declined confirmation, and failed execution leave order and payment state unchanged."
      },
      description: "Complete a checkout with exact scope, authorization, confirmation, exactly-once charging, failure isolation, and recovery.",
      id: "complete",
      title: "Complete checkout"
    })
  ],
  title: "Checkout conformance"
});

const billingMutationPack = createPack({
  description: "Assurance obligations for consequential subscription, invoice, credit, and other billing mutations.",
  id: "aic.pack.billing-mutation",
  profiles: [
    createMutationProfile({
      descriptions: {
        audit: "A successful billing mutation emits a durable receipt and audit event.",
        authorizationAllowed: "An authorized actor is allowed to continue with the requested account billing mutation.",
        authorizationDenied: "An unauthorized actor is denied before a billing mutation or confirmation.",
        confirmationAccepted: "The actor accepts the exact monetary, plan, and account confirmation.",
        confirmationDeclined: "A declined monetary, plan, or account confirmation stops the billing mutation.",
        exactScope: "The operation is bound to the intended account, billing entity, amount, currency, and plan or invoice.",
        failureIsolation: "Provider or business failure cannot leave a partial billing mutation.",
        idempotency: "An idempotency boundary prevents duplicate provider-side mutations.",
        mutation: "Exactly the authorized billing mutation is committed once.",
        recovery: "Provider ambiguity has an explicit reconciliation or safe retry path.",
        unchanged: "Stopped or failed billing operations leave the prior billing state unchanged."
      },
      description: "Mutate billing state with exact monetary scope, confirmation, idempotency, receipts, and provider recovery.",
      id: "mutate",
      title: "Billing mutation"
    })
  ],
  title: "Billing mutation conformance"
});

const accountDeletionPack = createPack({
  description: "Assurance obligations for destructive account deletion and recovery-safe termination.",
  id: "aic.pack.account-deletion",
  profiles: [
    createMutationProfile({
      descriptions: {
        audit: "Completion produces durable deletion or scheduled-deletion evidence.",
        authorizationAllowed: "Fresh reauthorization proves the actor may delete the exact account.",
        authorizationDenied: "Failed or insufficient reauthorization denies account deletion before confirmation.",
        confirmationAccepted: "The actor explicitly accepts deletion of the exact account and its destructive consequences.",
        confirmationDeclined: "Declining the exact-account deletion confirmation stops deletion.",
        exactScope: "Deletion is bound to the intended account and cannot expand to another tenant or identity.",
        failureIsolation: "Failure cannot leave an undocumented partial deletion across account resources.",
        idempotency: "Repeated delivery cannot delete additional accounts or duplicate external cleanup.",
        mutation: "Only the intended account is deleted or irreversibly scheduled for deletion.",
        recovery: "Partial cleanup has an explicit, auditable continuation or operator recovery path.",
        unchanged: "Denial, declined confirmation, and pre-commit failure leave the account active and unchanged."
      },
      description: "Delete an account only after scoped reauthorization and explicit confirmation, with no-op stopped paths and auditable recovery.",
      id: "delete",
      title: "Delete account"
    })
  ],
  title: "Account deletion conformance"
});

const adminMutationPack = createPack({
  description: "Assurance obligations for role-restricted administrative mutations.",
  id: "aic.pack.admin-mutation",
  profiles: [
    createMutationProfile({
      descriptions: {
        audit: "A successful mutation emits an immutable actor, target, before-state, and after-state audit event.",
        authorizationAllowed: "The required administrative role and tenant scope allow execution.",
        authorizationDenied: "Missing administrative role or tenant scope denies execution before confirmation.",
        confirmationAccepted: "The actor accepts the exact administrative target and material effect.",
        confirmationDeclined: "Declining the exact administrative target confirmation stops execution.",
        exactScope: "The operation is bound to the intended tenant, record, and administrative action.",
        failureIsolation: "Failure cannot leave an unaudited or partially applied administrative state.",
        idempotency: "Repeated delivery cannot apply the administrative mutation more than once.",
        mutation: "Exactly the authorized target receives the requested administrative mutation.",
        recovery: "A failed administrative mutation has an explicit rollback, retry, or operator recovery path.",
        unchanged: "Denial, declined confirmation, and failure leave the target unchanged."
      },
      description: "Apply a role-restricted administrative mutation with exact targeting, confirmation, audit evidence, and no partial effects.",
      id: "mutate",
      title: "Administrative mutation"
    })
  ],
  title: "Administrative mutation conformance"
});

function createRecordReadProfile(): AICConformanceProfile {
  return {
    description: "Read one explicitly scoped record without mutation, with authorization, failure isolation, and recovery.",
    id: "read",
    required_scenario_classes: ["success", "authorization_denial", "business_failure", "recovery"],
    requirements: [
      {
        description: "The request is bound to the intended tenant, record type, and record identifier.",
        id: "exact_scope",
        minimum_bindings: 1,
        phase: "precondition"
      },
      {
        description: "Record-level authorization allows the exact record representation to be returned.",
        id: "authorization_allowed",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: "Missing record-level authorization denies the read before data is returned.",
        id: "authorization_denied",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: "Read execution never mutates the record or related resources.",
        id: "no_mutation",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: "Backend or transport failure cannot disclose partial unauthorized data.",
        id: "failure_isolation",
        minimum_bindings: 1,
        phase: "invariant"
      },
      {
        description: "The exact authorized record representation is returned.",
        id: "record_returned",
        minimum_bindings: 1,
        phase: "postcondition"
      },
      {
        description: "A transient read failure has a bounded, non-mutating retry path.",
        id: "safe_recovery",
        minimum_bindings: 1,
        phase: "recovery"
      }
    ],
    scenarios: [
      {
        allowed_confirmations: ["not_required"],
        allowed_statuses: ["succeeded"],
        class: "success",
        forbidden_requirement_refs: ["authorization_denied"],
        id: "success",
        parity: "required",
        requirement_refs: ["exact_scope", "authorization_allowed", "no_mutation", "record_returned"],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["not_reached", "not_required"],
        allowed_statuses: ["denied"],
        class: "authorization_denial",
        forbidden_requirement_refs: ["authorization_allowed", "record_returned"],
        id: "authorization_denial",
        parity: "required",
        requirement_refs: ["exact_scope", "authorization_denied", "no_mutation"],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["not_required"],
        allowed_statuses: ["failed"],
        class: "business_failure",
        forbidden_requirement_refs: ["authorization_denied", "record_returned"],
        id: "business_failure",
        parity: "required",
        requirement_refs: ["exact_scope", "authorization_allowed", "no_mutation", "failure_isolation"],
        surface_roles: ["human", "agent"]
      },
      {
        allowed_confirmations: ["not_required"],
        allowed_statuses: ["recovered"],
        class: "recovery",
        forbidden_requirement_refs: ["authorization_denied"],
        id: "recovery",
        parity: "required",
        requirement_refs: ["exact_scope", "authorization_allowed", "no_mutation", "safe_recovery", "record_returned"],
        surface_roles: ["human", "agent"]
      }
    ],
    title: "Read record"
  };
}

function recordMutationProfile(id: "create" | "update" | "delete"): AICConformanceProfile {
  const title = `${id[0].toUpperCase()}${id.slice(1)} record`;
  return createMutationProfile({
    descriptions: {
      audit: `Successful ${id} produces a durable record-level audit event.`,
      authorizationAllowed: `Record-level authorization permits ${id} in the intended tenant.`,
      authorizationDenied: `Missing record-level authorization denies ${id} before confirmation or mutation.`,
      confirmationAccepted: `The actor accepts the exact record ${id} scope and material effect.`,
      confirmationDeclined: `Declining the exact record ${id} confirmation stops mutation.`,
      exactScope: `The ${id} operation is bound to the intended tenant, record type, and record identity.`,
      failureIsolation: `Failure cannot leave a partial or cross-record ${id} mutation.`,
      idempotency: `Repeated delivery cannot apply the record ${id} more than once.`,
      mutation: `Exactly the intended record ${id} mutation is committed.`,
      recovery: `A failed record ${id} has an explicit safe retry, rollback, or reconciliation path.`,
      unchanged: `Denial, declined confirmation, and failure leave record state unchanged.`
    },
    description: `${title} with exact entity scope, authorization, confirmation, idempotency, and recovery.`,
    id,
    title
  });
}

const recordCrudPack = createPack({
  description: "Separate profiles for record create, read, update, and delete operations.",
  id: "aic.pack.record-crud",
  profiles: [
    recordMutationProfile("create"),
    createRecordReadProfile(),
    recordMutationProfile("update"),
    recordMutationProfile("delete")
  ],
  title: "Record CRUD conformance"
});

const BUILTIN_PACKS: AICConformancePack[] = [
  checkoutPack,
  billingMutationPack,
  accountDeletionPack,
  adminMutationPack,
  recordCrudPack
];

export const AIC_BUILTIN_CONFORMANCE_PACK_IDS = BUILTIN_PACKS.map((pack) => pack.id);

export function listAICBuiltInConformancePacks(): AICConformancePack[] {
  return structuredClone(BUILTIN_PACKS);
}

export function getAICBuiltInConformancePack(id: string): AICConformancePack | undefined {
  const pack = BUILTIN_PACKS.find((candidate) => candidate.id === id);
  return pack ? structuredClone(pack) : undefined;
}
