import type { AICMetadataProps } from "@aicorg/sdk-react";

export interface RadixAICOptions {
  description?: string;
  entityId?: string;
  entityLabel?: string;
  entityType?: string;
  id: string;
  risk?: AICMetadataProps["agentRisk"];
  workflowStep?: string;
}

function withSharedMetadata(
  metadata: AICMetadataProps,
  options: RadixAICOptions
): AICMetadataProps {
  return {
    ...metadata,
    agentEntityId: options.entityId,
    agentEntityLabel: options.entityLabel,
    agentEntityType: options.entityType,
    agentWorkflowStep: options.workflowStep
  };
}

export function createRadixDialogTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "click",
    agentDescription: options.description ?? "Opens a dialog",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "dialog_trigger"
  }, options);
}

export function createRadixDialogContentAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "read",
    agentDescription: options.description ?? "Reads dialog contents",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "dialog"
  }, options);
}

export function createRadixDialogCloseAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "click",
    agentDescription: options.description ?? "Closes a dialog",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "button"
  }, options);
}

export function createRadixSelectAICProps(options: RadixAICOptions): AICMetadataProps {
  return {
    ...createRadixSelectTriggerAICProps(options),
    agentRole: "select"
  };
}

export function createRadixSelectTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "select",
    agentDescription: options.description ?? "Opens a selection menu",
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "combobox"
  }, options);
}

export function createRadixSelectItemAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "select",
    agentDescription: options.description ?? "Selects an option",
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "option"
  }, options);
}

export function createRadixSelectContentAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "read",
    agentDescription: options.description ?? "Reads the available options",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "listbox"
  }, options);
}

export function createRadixDropdownMenuTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "click",
    agentDescription: options.description ?? "Opens an action menu",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "button"
  }, options);
}

export function createRadixDropdownMenuContentAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "read",
    agentDescription: options.description ?? "Reads the available menu actions",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "menu"
  }, options);
}

export function createRadixMenuItemAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "click",
    agentDescription: options.description ?? "Runs a menu action",
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "menuitem"
  }, options);
}

export function createRadixDropdownMenuItemAICProps(options: RadixAICOptions): AICMetadataProps {
  return createRadixMenuItemAICProps(options);
}

export function createRadixCheckboxAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "toggle",
    agentDescription: options.description ?? "Toggles a checkbox",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "checkbox"
  }, options);
}

export function createRadixSwitchAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "toggle",
    agentDescription: options.description ?? "Toggles a switch",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "switch"
  }, options);
}

export function createRadixTabsTriggerAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "select",
    agentDescription: options.description ?? "Switches to a tab",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "tab"
  }, options);
}

export function createRadixTabsListAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "read",
    agentDescription: options.description ?? "Reads the available tabs",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "tablist"
  }, options);
}

export function createRadixTabsContentAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "read",
    agentDescription: options.description ?? "Reads tab content",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "tabpanel"
  }, options);
}

export function createRadixLinkAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "navigate",
    agentDescription: options.description ?? "Navigates to a linked view",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "link"
  }, options);
}

export function createRadixFormAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "submit",
    agentDescription: options.description ?? "Submits a form",
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: "form"
  }, options);
}

export function createRadixSearchInputAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "input",
    agentDescription: options.description ?? "Updates search input",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "searchbox"
  }, options);
}

export function createRadixTextareaAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "input",
    agentDescription: options.description ?? "Updates multiline text",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "textarea"
  }, options);
}

export function createRadixRadioAICProps(options: RadixAICOptions): AICMetadataProps {
  return withSharedMetadata({
    agentAction: "select",
    agentDescription: options.description ?? "Selects a radio option",
    agentId: options.id,
    agentRisk: options.risk ?? "low",
    agentRole: "radio"
  }, options);
}

export function createRadixEntityActionAICProps(
  options: RadixAICOptions & {
    action?: AICMetadataProps["agentAction"];
    role?: AICMetadataProps["agentRole"];
  }
): AICMetadataProps {
  return withSharedMetadata({
    agentAction: options.action ?? "click",
    agentDescription: options.description ?? "Runs an entity-scoped action",
    agentId: options.id,
    agentRisk: options.risk ?? "medium",
    agentRole: options.role ?? "button"
  }, options);
}
