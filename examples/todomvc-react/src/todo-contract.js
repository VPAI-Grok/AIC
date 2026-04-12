const TODOS_MANAGE_PERMISSION = ["todos.manage"];

export const TODO_VIEW = {
  url: "http://localhost:5173/",
  view_id: "todos.root"
};

export const NEW_TODO_INPUT_PROPS = {
  agentAction: "input",
  agentDescription: "Capture the title for a new todo item and submit it with Enter.",
  agentExamples: ["Review quarterly plan", "Email customer about renewal"],
  agentId: "todos.create.title",
  agentLabel: "New todo title",
  agentPermissions: TODOS_MANAGE_PERMISSION,
  agentRisk: "low",
  agentValidation: {
    max_length: 120,
    required: true
  },
  agentWorkflowStep: "todos.capture.add"
};

export const TOGGLE_ALL_PROPS = {
  agentAction: "click",
  agentDescription: "Mark every todo in the list completed or active in one bulk update.",
  agentEffects: ["todos.bulk_completion_updated"],
  agentId: "todos.toggle_all",
  agentLabel: "Toggle all todos",
  agentPermissions: TODOS_MANAGE_PERMISSION,
  agentRisk: "medium",
  agentWorkflowStep: "todos.bulk.toggle"
};

export function createTodoToggleProps(todo) {
  return {
    agentAction: "click",
    agentDescription: `Toggle completion status for "${todo.title}".`,
    agentEntityId: todo.id,
    agentEntityLabel: todo.title,
    agentEntityType: "todo",
    agentId: `todo.toggle.${todo.id}`,
    agentPermissions: TODOS_MANAGE_PERMISSION,
    agentRisk: "low",
    agentWorkflowStep: "todos.item.toggle"
  };
}

export function createTodoDeleteProps(todo) {
  return {
    agentAction: "click",
    agentDescription: `Delete todo "${todo.title}" from the list.`,
    agentEffects: ["todo.deleted"],
    agentEntityId: todo.id,
    agentEntityLabel: todo.title,
    agentEntityType: "todo",
    agentId: `todo.delete.${todo.id}`,
    agentPermissions: TODOS_MANAGE_PERMISSION,
    agentRisk: "high",
    agentWorkflowStep: "todos.item.delete"
  };
}

export function createTodoEditInputProps(todo) {
  return {
    agentAction: "input",
    agentDescription: `Edit the title for todo "${todo.title}".`,
    agentEntityId: todo.id,
    agentEntityLabel: todo.title,
    agentEntityType: "todo",
    agentExamples: ["Send invoice follow-up", "Prepare launch checklist"],
    agentId: `todo.edit.${todo.id}`,
    agentNotes: [
      "Submitting an empty title deletes the todo.",
      "Press Escape to cancel editing."
    ],
    agentPermissions: TODOS_MANAGE_PERMISSION,
    agentRisk: "medium",
    agentValidation: {
      max_length: 120,
      required: true
    },
    agentWorkflowStep: "todos.item.edit"
  };
}

export const FILTER_ALL_PROPS = {
  agentAction: "click",
  agentDescription: "Show all todo items, regardless of completion status.",
  agentId: "todos.filter.all",
  agentLabel: "Show all todos",
  agentRisk: "low",
  agentWorkflowStep: "todos.filter.all"
};

export const FILTER_ACTIVE_PROPS = {
  agentAction: "click",
  agentDescription: "Show only active todo items.",
  agentId: "todos.filter.active",
  agentLabel: "Show active todos",
  agentRisk: "low",
  agentWorkflowStep: "todos.filter.active"
};

export const FILTER_COMPLETED_PROPS = {
  agentAction: "click",
  agentDescription: "Show only completed todo items.",
  agentId: "todos.filter.completed",
  agentLabel: "Show completed todos",
  agentRisk: "low",
  agentWorkflowStep: "todos.filter.completed"
};

export function createClearCompletedProps(completedCount) {
  const completedLabel = `${completedCount} completed todo${completedCount === 1 ? "" : "s"}`;

  return {
    agentAction: "click",
    agentConfirmation: {
      prompt_template: "Clear {{completed_count}} completed todos from the list?",
      summary_fields: ["completed_count"],
      type: "human_review"
    },
    agentDescription: `Permanently remove ${completedLabel} from the list.`,
    agentEffects: ["todos.completed.deleted"],
    agentId: "todos.clear_completed",
    agentLabel: "Clear completed todos",
    agentPermissions: TODOS_MANAGE_PERMISSION,
    agentRequiresConfirmation: true,
    agentRisk: "critical",
    agentWorkflowStep: "todos.bulk.clear_completed.review"
  };
}
