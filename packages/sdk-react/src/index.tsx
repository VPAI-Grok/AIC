import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  type ComponentPropsWithoutRef,
  type ElementType,
  type PropsWithChildren,
  type ReactNode
} from "react";
import { AICRegistry, createAICDataAttributes } from "@aic/runtime";
import type {
  AICActionName,
  AICConfirmationProtocol,
  AICElementManifest,
  AICExecutionMetadata,
  AICRecoveryMetadata,
  AICRisk,
  AICRole,
  AICValidationMetadata
} from "@aic/spec";

const defaultRegistry = new AICRegistry();
const AICRegistryContext = createContext<AICRegistry>(defaultRegistry);

interface AICComponentConfig {
  defaultAction: AICActionName;
  defaultAs: ElementType;
  role: AICRole;
}

export interface AICMetadataProps {
  agentAction?: AICActionName;
  agentAliases?: string[];
  agentConfirmation?: Partial<AICConfirmationProtocol>;
  agentDescription?: string;
  agentEffects?: string[];
  agentEntityId?: string;
  agentEntityLabel?: string;
  agentEntityType?: string;
  agentExamples?: string[];
  agentExecution?: AICExecutionMetadata;
  agentId: string;
  agentLabel?: string;
  agentNotes?: string[];
  agentPermissions?: string[];
  agentRecovery?: AICRecoveryMetadata;
  agentRequiresConfirmation?: boolean;
  agentRisk?: AICRisk;
  agentRole?: AICRole;
  agentValidation?: AICValidationMetadata;
  agentWorkflowStep?: string;
  state?: AICElementManifest["state"];
}

export interface AICElementHookOptions {
  defaultAction?: AICActionName;
  role?: AICRole;
}

export function AICProvider({
  children,
  registry = defaultRegistry
}: PropsWithChildren<{ registry?: AICRegistry }>) {
  return createElement(AICRegistryContext.Provider, {
    value: registry,
    children
  });
}

export function useAICRegistry(): AICRegistry {
  return useContext(AICRegistryContext);
}

function inferLabel(children: ReactNode, explicitLabel: string | undefined, description: string | undefined): string {
  if (explicitLabel) {
    return explicitLabel;
  }

  if (typeof children === "string" && children.trim().length > 0) {
    return children;
  }

  return description ?? "Interactive element";
}

function buildConfirmation(
  props: AICMetadataProps
): AICConfirmationProtocol | undefined {
  if (!props.agentRequiresConfirmation && !props.agentConfirmation) {
    return undefined;
  }

  return {
    type: props.agentConfirmation?.type ?? "human_review",
    expires_in_seconds: props.agentConfirmation?.expires_in_seconds,
    prompt_template: props.agentConfirmation?.prompt_template,
    requires_manual_phrase: props.agentConfirmation?.requires_manual_phrase,
    reusable_for_batch: props.agentConfirmation?.reusable_for_batch,
    summary_fields: props.agentConfirmation?.summary_fields
  };
}

function buildElementManifest(
  props: AICMetadataProps & { children?: ReactNode },
  options: AICElementHookOptions
): AICElementManifest {
  const action = props.agentAction ?? options.defaultAction ?? "custom";
  const role = props.agentRole ?? options.role ?? "generic";

  return {
    id: props.agentId,
    label: inferLabel(props.children, props.agentLabel, props.agentDescription),
    description: props.agentDescription,
    role,
    actions: [
      {
        name: action,
        target: props.agentId,
        type: "element_action"
      }
    ],
    aliases: props.agentAliases,
    confirmation: buildConfirmation(props),
    effects: props.agentEffects,
    entity_ref:
      props.agentEntityType && props.agentEntityId
        ? {
            entity_id: props.agentEntityId,
            entity_label: props.agentEntityLabel,
            entity_type: props.agentEntityType
          }
        : undefined,
    examples: props.agentExamples,
    execution: props.agentExecution,
    notes: props.agentNotes,
    permissions: props.agentPermissions,
    recovery: props.agentRecovery,
    requires_confirmation: props.agentRequiresConfirmation,
    risk: props.agentRisk ?? "medium",
    state: props.state ?? {
      busy: false,
      enabled: true,
      visible: true
    },
    validation: props.agentValidation,
    workflow_ref: props.agentWorkflowStep
  };
}

function warnInvalidMetadata(props: AICMetadataProps): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return;
  }

  if (!props.agentDescription && (props.agentRisk === "high" || props.agentRisk === "critical")) {
    console.warn(`[AIC] ${props.agentId} is ${props.agentRisk} risk but has no description.`);
  }

  if (
    props.agentRisk === "critical" &&
    props.agentRequiresConfirmation &&
    !props.agentConfirmation?.prompt_template
  ) {
    console.warn(
      `[AIC] ${props.agentId} is critical risk but is missing a confirmation prompt template.`
    );
  }

  if (
    props.agentWorkflowStep?.includes("row") &&
    (!props.agentEntityId || !props.agentEntityType)
  ) {
    console.warn(`[AIC] ${props.agentId} appears row-scoped but has no entity identity.`);
  }

  if (/button_\d+/.test(props.agentId)) {
    console.warn(`[AIC] ${props.agentId} looks unstable. Prefer semantic, app-level IDs.`);
  }
}

export function useAICElement(
  props: AICMetadataProps & { children?: ReactNode },
  options: AICElementHookOptions = {}
): { attributes: Record<string, string>; element: AICElementManifest } {
  const registry = useAICRegistry();
  const instanceId = useId();

  const aliasesKey = props.agentAliases?.join("|") ?? "";
  const effectsKey = props.agentEffects?.join("|") ?? "";
  const examplesKey = props.agentExamples?.join("|") ?? "";
  const notesKey = props.agentNotes?.join("|") ?? "";
  const permissionsKey = props.agentPermissions?.join("|") ?? "";
  const confirmationKey = JSON.stringify(props.agentConfirmation ?? null);
  const executionKey = JSON.stringify(props.agentExecution ?? null);
  const recoveryKey = JSON.stringify(props.agentRecovery ?? null);
  const validationKey = JSON.stringify(props.agentValidation ?? null);
  const stateKey = JSON.stringify(props.state ?? null);

  const element = buildElementManifest(props, options);

  useEffect(() => {
    warnInvalidMetadata(props);

    return registry.register({
      element,
      instanceId,
      source: "authored"
    });
  }, [
    registry,
    instanceId,
    element,
    props.agentAction,
    props.agentAliases,
    props.agentDescription,
    props.agentEntityId,
    props.agentEntityLabel,
    props.agentEntityType,
    props.agentId,
    props.agentLabel,
    props.agentRequiresConfirmation,
    props.agentRisk,
    props.agentRole,
    props.agentWorkflowStep,
    aliasesKey,
    effectsKey,
    examplesKey,
    notesKey,
    permissionsKey,
    confirmationKey,
    executionKey,
    recoveryKey,
    validationKey,
    stateKey
  ]);

  return {
    element,
    attributes: createAICDataAttributes(element)
  };
}

export type AICComponentProps<T extends ElementType> = {
  as?: T;
  children?: ReactNode;
} & AICMetadataProps &
  Omit<ComponentPropsWithoutRef<T>, keyof AICMetadataProps | "as" | "children">;

export function createAICComponent<TDefault extends ElementType>(config: AICComponentConfig) {
  return function AICComponent<T extends ElementType = TDefault>(props: AICComponentProps<T>) {
    const {
      as,
      children,
      agentAction,
      agentAliases,
      agentConfirmation,
      agentDescription,
      agentEffects,
      agentEntityId,
      agentEntityLabel,
      agentEntityType,
      agentExamples,
      agentExecution,
      agentId,
      agentLabel,
      agentNotes,
      agentPermissions,
      agentRecovery,
      agentRequiresConfirmation,
      agentRisk,
      agentRole,
      agentValidation,
      agentWorkflowStep,
      state,
      ...nativeProps
    } = props;
    const Component = (as ?? config.defaultAs) as ElementType;
    const { attributes } = useAICElement(
      {
        agentAction,
        agentAliases,
        agentConfirmation,
        agentDescription,
        agentEffects,
        agentEntityId,
        agentEntityLabel,
        agentEntityType,
        agentExamples,
        agentExecution,
        agentId,
        agentLabel,
        agentNotes,
        agentPermissions,
        agentRecovery,
        agentRequiresConfirmation,
        agentRisk,
        agentRole,
        agentValidation,
        agentWorkflowStep,
        children,
        state
      },
      {
        defaultAction: config.defaultAction,
        role: config.role
      }
    );

    return createElement(
      Component,
      {
        ...nativeProps,
        ...attributes
      },
      children
    );
  };
}

export const AIC = {
  Button: createAICComponent({ defaultAs: "button", defaultAction: "click", role: "button" }),
  Input: createAICComponent({ defaultAs: "input", defaultAction: "input", role: "input" }),
  Select: createAICComponent({ defaultAs: "select", defaultAction: "select", role: "select" }),
  Form: createAICComponent({ defaultAs: "form", defaultAction: "submit", role: "form" }),
  Table: createAICComponent({ defaultAs: "table", defaultAction: "read", role: "table" })
};

export const AICButton = AIC.Button;
export const AICInput = AIC.Input;
export const AICSelect = AIC.Select;
export const AICForm = AIC.Form;
export const AICTable = AIC.Table;

export const AgentProvider = AICProvider;
export const useAgentRegistry = useAICRegistry;
export function useAgentAttributes(props: AICMetadataProps & { children?: ReactNode }) {
  return useAICElement(props).attributes;
}

export const Agent = createAICComponent({ defaultAs: "button", defaultAction: "click", role: "button" });
