import { AICButton, AICInput, type AICComponentProps } from "@aicorg/sdk-react";

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
