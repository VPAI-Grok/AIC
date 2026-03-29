/** @typedef {import("@aic/sdk-react").AICMetadataProps} AICMetadataProps */

export const CRM_VIEW = /** @type {{
  pageTitle: string;
  route_pattern: string;
  url: string;
  view_id: string;
}} */ ({
  pageTitle: "Customers",
  route_pattern: "/customers",
  url: "http://localhost:5173/customers",
  view_id: "crm.customers"
});

export const ARCHIVE_CUSTOMER_PROPS = /** @type {AICMetadataProps} */ ({
  agentConfirmation: {
    prompt_template: "Archive customer {{customer_id}}? This hides the record from active views.",
    type: "human_review"
  },
  agentDescription: "Opens the archive confirmation dialog for the selected customer",
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentId: "customer.archive",
  agentLabel: "Archive customer",
  agentNotes: ["Requires billing_manager role", "Appears in row actions"],
  agentRequiresConfirmation: true,
  agentRisk: "high",
  agentWorkflowStep: "customer.archive.review"
});

export const CUSTOMER_ACTIONS_TRIGGER_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Opens the customer actions menu",
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentId: "customer.actions_menu",
  agentLabel: "Customer actions",
  agentRisk: "low"
});

export const CUSTOMER_ACTIONS_MENU_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Lists the actions available for the selected customer",
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentId: "customer.actions_menu.content",
  agentLabel: "Customer actions menu",
  agentRisk: "low",
  agentRole: "menu"
});

export const SEND_RENEWAL_REMINDER_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "click",
  agentDescription: "Sends a renewal reminder email to the current customer",
  agentEffects: ["email.dispatch", "customer.last_contacted=now"],
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentExecution: {
    estimated_latency_ms: 2500,
    settled_when: ["toast.visible = true"]
  },
  agentId: "customer.send_renewal_email",
  agentLabel: "Send renewal reminder",
  agentRecovery: {
    error_code: "transient_backend_failure",
    recovery: "retry_email_send",
    retry_after_ms: 5000,
    retryable: true
  },
  agentRisk: "medium",
  agentWorkflowStep: "customer.renewal.outreach.send"
});

export const ARCHIVE_DIALOG_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Shows the archive impact summary for the selected customer",
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentId: "customer.archive.dialog",
  agentRisk: "medium"
});

export const ARCHIVE_DIALOG_CLOSE_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "click",
  agentDescription: "Dismisses the archive customer dialog without making changes",
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentId: "customer.archive.dialog.close",
  agentLabel: "Cancel archive",
  agentRisk: "low",
  agentWorkflowStep: "customer.archive.review"
});

export const ACCOUNT_STATUS_TRIGGER_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Opens the account status filter",
  agentId: "customer.filter.account_status"
});

export const ACCOUNT_STATUS_OPTIONS_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Shows the available account status filter options",
  agentId: "customer.filter.account_status.options",
  agentRole: "listbox"
});

export const ACCOUNT_STATUS_ACTIVE_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "select",
  agentDescription: "Filters customers with active status",
  agentId: "customer.filter.account_status.active",
  agentLabel: "Active",
  agentRisk: "low",
  agentRole: "option"
});

export const ACCOUNT_STATUS_TRIAL_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "select",
  agentDescription: "Filters customers with trial status",
  agentId: "customer.filter.account_status.trial",
  agentLabel: "Trial",
  agentRisk: "low",
  agentRole: "option"
});

export const ACCOUNT_STATUS_AT_RISK_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "select",
  agentDescription: "Filters customers with at-risk status",
  agentId: "customer.filter.account_status.at_risk",
  agentLabel: "At-risk",
  agentRisk: "medium",
  agentRole: "option"
});

export const SHOW_ARCHIVED_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Toggles whether archived accounts are shown in the CRM list",
  agentId: "customer.filter.show_archived",
  agentLabel: "Show archived accounts"
});

export const OVERVIEW_TAB_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Switches to the customer overview tab",
  agentId: "customer.view.overview_tab"
});

export const BILLING_TAB_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "select",
  agentDescription: "Switches to the billing tab",
  agentId: "customer.view.billing_tab",
  agentRisk: "low",
  agentRole: "tab"
});

export const OVERVIEW_PANEL_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Reads the customer overview panel contents",
  agentId: "customer.view.overview_panel"
});

export const RENEWAL_NOTE_INPUT_PROPS = /** @type {AICMetadataProps} */ ({
  agentDescription: "Captures the next renewal follow-up note for the selected customer",
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentId: "customer.renewal_note",
  agentLabel: "Renewal note",
  agentRisk: "low",
  agentValidation: {
    examples: ["Renewal call scheduled for Tuesday at 3 PM."],
    max_length: 240,
    min_length: 12,
    required: true
  },
  agentWorkflowStep: "customer.renewal.note.capture"
});

export const SAVE_RENEWAL_NOTE_PROPS = /** @type {AICMetadataProps} */ ({
  agentAction: "submit",
  agentDescription: "Stores the current renewal note on the customer record",
  agentEffects: ["customer.timeline += renewal_note"],
  agentEntityId: "cus_2048",
  agentEntityLabel: "Northwind Traders",
  agentEntityType: "customer",
  agentExecution: {
    estimated_latency_ms: 1600,
    settled_when: ["customer.timeline.updated = true"]
  },
  agentId: "customer.renewal_note.save",
  agentLabel: "Save renewal note",
  agentRisk: "medium",
  agentWorkflowStep: "customer.renewal.note.capture"
});
