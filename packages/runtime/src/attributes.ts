import type { AICElementManifest } from "@aicorg/spec";

export function createAICDataAttributes(element: AICElementManifest): Record<string, string> {
  const attributes: Record<string, string> = {
    "data-agent-id": element.id,
    "data-agent-label": element.label,
    "data-agent-role": element.role,
    "data-agent-risk": element.risk
  };

  if (element.description) {
    attributes["data-agent-description"] = element.description;
  }

  if (element.actions.length > 0) {
    attributes["data-agent-action"] = element.actions[0]?.name ?? "custom";
  }

  if (element.requires_confirmation) {
    attributes["data-agent-confirmation"] = element.confirmation?.type ?? "required";
  }

  if (element.workflow_ref) {
    attributes["data-agent-workflow"] = element.workflow_ref;
  }

  if (element.entity_ref?.entity_type) {
    attributes["data-agent-entity-type"] = element.entity_ref.entity_type;
  }

  if (element.entity_ref?.entity_id) {
    attributes["data-agent-entity-id"] = element.entity_ref.entity_id;
  }

  return attributes;
}

export const createAgentDataAttributes = createAICDataAttributes;
