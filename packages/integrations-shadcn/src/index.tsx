import { AIC, AICButton, AICInput, useAICElement, type AICComponentProps } from "@aicorg/sdk-react";

export function ShadcnAICButton(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      style={{
        borderRadius: 10,
        fontWeight: 600,
        padding: "10px 16px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICInput(props: AICComponentProps<"input">) {
  return (
    <AICInput
      {...props}
      style={{
        border: "1px solid rgba(15, 23, 42, 0.16)",
        borderRadius: 10,
        padding: "10px 12px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICSearchInput(props: AICComponentProps<"input">) {
  return (
    <AICInput
      {...props}
      agentAction={props.agentAction ?? "input"}
      agentRole={props.agentRole ?? "searchbox"}
      style={{
        border: "1px solid rgba(15, 23, 42, 0.16)",
        borderRadius: 999,
        padding: "10px 14px",
        ...(props.style ?? {})
      }}
      type={props.type ?? "search"}
    />
  );
}

export function ShadcnAICTable(props: AICComponentProps<"table">) {
  return (
    <AIC.Table
      {...props}
      style={{
        borderCollapse: "separate",
        borderSpacing: 0,
        width: "100%",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICLink(props: AICComponentProps<"a">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "navigate"}
      agentRole={props.agentRole ?? "link"}
      as="a"
      style={{
        color: "#0f766e",
        fontWeight: 600,
        textDecoration: "none",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICForm(props: AICComponentProps<"form">) {
  return (
    <AIC.Form
      {...props}
      style={{
        display: "grid",
        gap: 12,
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICTextarea(props: AICComponentProps<"textarea">) {
  const {
    children,
    style,
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
    defaultValue,
    value,
    ...nativeProps
  } = props;
  const initialValue =
    value === undefined && defaultValue === undefined && (typeof children === "string" || typeof children === "number")
      ? String(children)
      : undefined;
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
      agentRole: agentRole ?? "textarea",
      agentValidation,
      agentWorkflowStep,
      children,
      state
    },
    {
      defaultAction: "input",
      role: "textarea"
    }
  );

  return (
    <textarea
      {...nativeProps}
      {...attributes}
      defaultValue={defaultValue ?? initialValue}
      style={{
        border: "1px solid rgba(15, 23, 42, 0.16)",
        borderRadius: 12,
        minHeight: 112,
        padding: "12px 14px",
        resize: "vertical",
        ...(style ?? {})
      }}
      value={value}
    />
  );
}

export function ShadcnAICCheckbox(props: AICComponentProps<"input">) {
  return (
    <AICInput
      {...props}
      agentAction={props.agentAction ?? "toggle"}
      agentRole={props.agentRole ?? "checkbox"}
      style={{
        accentColor: "#0f766e",
        borderRadius: 6,
        cursor: "pointer",
        height: 18,
        width: 18,
        ...(props.style ?? {})
      }}
      type={props.type ?? "checkbox"}
    />
  );
}

export function ShadcnAICRadio(props: AICComponentProps<"input">) {
  return (
    <AICInput
      {...props}
      agentAction={props.agentAction ?? "select"}
      agentRole={props.agentRole ?? "radio"}
      style={{
        accentColor: "#0f766e",
        cursor: "pointer",
        height: 18,
        width: 18,
        ...(props.style ?? {})
      }}
      type={props.type ?? "radio"}
    />
  );
}

export function ShadcnAICDialogTrigger(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "click"}
      agentRole={props.agentRole ?? "dialog_trigger"}
      style={{
        background: "#0f172a",
        border: 0,
        borderRadius: 999,
        color: "#f8fafc",
        cursor: "pointer",
        fontWeight: 700,
        padding: "12px 18px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICDialogContent(props: AICComponentProps<"section">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "read"}
      agentRole={props.agentRole ?? "dialog"}
      as="section"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(15, 23, 42, 0.12)",
        borderRadius: 18,
        boxShadow: "0 20px 48px rgba(15, 23, 42, 0.12)",
        padding: "18px 20px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICDialogClose(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "click"}
      agentRole={props.agentRole ?? "button"}
      style={{
        background: "#e2e8f0",
        border: 0,
        borderRadius: 999,
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: 600,
        padding: "10px 16px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICSelectTrigger(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "select"}
      agentRole={props.agentRole ?? "combobox"}
      style={{
        alignItems: "center",
        background: "#ffffff",
        border: "1px solid rgba(15, 23, 42, 0.16)",
        borderRadius: 12,
        cursor: "pointer",
        display: "inline-flex",
        gap: 8,
        justifyContent: "space-between",
        minWidth: 220,
        padding: "10px 14px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICSelectContent(props: AICComponentProps<"section">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "read"}
      agentRole={props.agentRole ?? "listbox"}
      as="section"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(15, 23, 42, 0.1)",
        borderRadius: 16,
        padding: "10px 12px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICSelectItem(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "select"}
      agentRole={props.agentRole ?? "option"}
      style={{
        background: "transparent",
        border: 0,
        borderRadius: 10,
        color: "#0f172a",
        cursor: "pointer",
        justifyContent: "flex-start",
        padding: "8px 10px",
        textAlign: "left",
        width: "100%",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICDropdownMenuTrigger(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "click"}
      agentRole={props.agentRole ?? "button"}
      style={{
        background: "#0f172a",
        border: 0,
        borderRadius: 999,
        color: "#f8fafc",
        cursor: "pointer",
        fontWeight: 700,
        padding: "10px 16px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICDropdownMenuContent(props: AICComponentProps<"section">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "read"}
      agentRole={props.agentRole ?? "menu"}
      as="section"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(15, 23, 42, 0.1)",
        borderRadius: 16,
        boxShadow: "0 16px 36px rgba(15, 23, 42, 0.12)",
        display: "grid",
        gap: 8,
        minWidth: 240,
        padding: "10px 12px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICDropdownMenuItem(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "click"}
      agentRole={props.agentRole ?? "menuitem"}
      style={{
        background: "transparent",
        border: 0,
        borderRadius: 12,
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: 600,
        justifyContent: "flex-start",
        padding: "10px 12px",
        textAlign: "left",
        width: "100%",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICTabsTrigger(props: AICComponentProps<"button">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "select"}
      agentRole={props.agentRole ?? "tab"}
      style={{
        background: "#e2e8f0",
        border: 0,
        borderRadius: 999,
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: 700,
        padding: "10px 16px",
        ...(props.style ?? {})
      }}
    />
  );
}

export function ShadcnAICTabsContent(props: AICComponentProps<"section">) {
  return (
    <AICButton
      {...props}
      agentAction={props.agentAction ?? "read"}
      agentRole={props.agentRole ?? "tabpanel"}
      as="section"
      style={{
        background: "#f8fafc",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        borderRadius: 18,
        padding: "16px 18px",
        ...(props.style ?? {})
      }}
    />
  );
}
