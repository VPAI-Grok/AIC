import { useEffect, useState } from "react";
import { AICDevtoolsBridge, AICDevtoolsOverlay } from "@aicorg/devtools";
import {
  ShadcnAICButton,
  ShadcnAICCheckbox,
  ShadcnAICDialogClose,
  ShadcnAICDialogContent,
  ShadcnAICDialogTrigger,
  ShadcnAICDropdownMenuContent,
  ShadcnAICDropdownMenuItem,
  ShadcnAICDropdownMenuTrigger,
  ShadcnAICInput,
  ShadcnAICSelectContent,
  ShadcnAICSelectItem,
  ShadcnAICSelectTrigger,
  ShadcnAICTabsContent,
  ShadcnAICTabsTrigger
} from "@aicorg/integrations-shadcn";
import { AIC, AICProvider, useAICRegistry } from "@aicorg/sdk-react";
import type { AICRuntimeUiManifest } from "@aicorg/spec";
import {
  ACCOUNT_STATUS_OPTIONS_PROPS,
  ACCOUNT_STATUS_ACTIVE_PROPS,
  ACCOUNT_STATUS_AT_RISK_PROPS,
  ACCOUNT_STATUS_TRIGGER_PROPS,
  ACCOUNT_STATUS_TRIAL_PROPS,
  ARCHIVE_CUSTOMER_PROPS,
  ARCHIVE_CONFIRM_PROPS,
  ARCHIVE_DIALOG_CLOSE_PROPS,
  ARCHIVE_DIALOG_PROPS,
  BILLING_TAB_PROPS,
  CRM_VIEW,
  CUSTOMER_ACTIONS_MENU_PROPS,
  CUSTOMER_ACTIONS_TRIGGER_PROPS,
  OVERVIEW_PANEL_PROPS,
  OVERVIEW_TAB_PROPS,
  RENEWAL_NOTE_INPUT_PROPS,
  SAVE_RENEWAL_NOTE_PROPS,
  SEND_RENEWAL_REMINDER_PROPS,
  SHOW_ARCHIVED_PROPS
} from "./crm-contract.mjs";

function RuntimeManifestPreview() {
  const registry = useAICRegistry();
  const [manifest, setManifest] = useState<AICRuntimeUiManifest>(
    registry.serializeRuntimeUi({
      url: "http://localhost:5173/customers",
      view_id: "crm.customers"
    })
  );

  useEffect(() => {
    return registry.subscribe(() => {
      setManifest(
        registry.serializeRuntimeUi({
          pageTitle: "Customers",
          route_pattern: "/customers",
          url: "http://localhost:5173/customers",
          view_id: "crm.customers"
        })
      );
    });
  }, [registry]);

  return (
    <pre
      style={{
        background: "#08111a",
        borderRadius: 18,
        color: "#f8fbff",
        overflowX: "auto",
        padding: 20
      }}
    >
      {JSON.stringify(manifest, null, 2)}
    </pre>
  );
}

export function App() {
  return (
    <AICProvider>
      <main
        style={{
          background:
            "radial-gradient(circle at top left, rgba(30, 136, 229, 0.14), transparent 42%), linear-gradient(180deg, #f5f8fc 0%, #edf3f8 100%)",
          color: "#13202d",
          minHeight: "100vh",
          padding: "40px 20px"
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 28,
            margin: "0 auto",
            maxWidth: 980
          }}
        >
          <section style={{ display: "grid", gap: 12 }}>
            <span
              style={{
                color: "#0f5f9a",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              Vite CRM Demo
            </span>
            <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: 0 }}>
              Runtime contract with confirmation, validation, execution, recovery, and workflow metadata
            </h1>
            <p style={{ fontSize: 18, margin: 0, maxWidth: 760 }}>
              This demo shows the richer AIC contract rather than only attaching data attributes
              to buttons. The runtime manifest includes entity identity, workflow references,
              confirmation details, validation guidance, execution hints, and recovery metadata.
            </p>
          </section>

          <section
            style={{
              background: "white",
              border: "1px solid rgba(19, 32, 45, 0.08)",
              borderRadius: 24,
              boxShadow: "0 24px 64px rgba(16, 24, 40, 0.08)",
              display: "grid",
              gap: 20,
              padding: 24
            }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <ShadcnAICDropdownMenuTrigger {...CUSTOMER_ACTIONS_TRIGGER_PROPS}>
                  Customer actions
                </ShadcnAICDropdownMenuTrigger>
              </div>

              <ShadcnAICDropdownMenuContent {...CUSTOMER_ACTIONS_MENU_PROPS}>
                <ShadcnAICDropdownMenuItem {...SEND_RENEWAL_REMINDER_PROPS} type="button">
                  Send renewal reminder
                </ShadcnAICDropdownMenuItem>
                <ShadcnAICDialogTrigger {...ARCHIVE_CUSTOMER_PROPS}>
                  Archive customer
                </ShadcnAICDialogTrigger>
              </ShadcnAICDropdownMenuContent>

              <ShadcnAICDialogContent {...ARCHIVE_DIALOG_PROPS}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    Archiving Northwind Traders removes the record from the active customer list
                    and pauses reminder workflows until it is restored.
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <ShadcnAICDialogClose {...ARCHIVE_DIALOG_CLOSE_PROPS} type="button">
                      Cancel archive
                    </ShadcnAICDialogClose>
                    <ShadcnAICButton
                      {...ARCHIVE_CONFIRM_PROPS}
                      style={{
                        background: "#b91c1c",
                        border: 0,
                        color: "white",
                        cursor: "pointer",
                        fontSize: 15
                      }}
                      type="button"
                    >
                      Confirm archive
                    </ShadcnAICButton>
                  </div>
                </div>
              </ShadcnAICDialogContent>

              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <ShadcnAICSelectTrigger {...ACCOUNT_STATUS_TRIGGER_PROPS}>
                  Account status
                </ShadcnAICSelectTrigger>
                <ShadcnAICSelectContent {...ACCOUNT_STATUS_OPTIONS_PROPS}>
                  <ShadcnAICSelectItem {...ACCOUNT_STATUS_ACTIVE_PROPS} type="button">
                    Active
                  </ShadcnAICSelectItem>
                  <ShadcnAICSelectItem {...ACCOUNT_STATUS_TRIAL_PROPS} type="button">
                    Trial
                  </ShadcnAICSelectItem>
                  <ShadcnAICSelectItem {...ACCOUNT_STATUS_AT_RISK_PROPS} type="button">
                    At-risk
                  </ShadcnAICSelectItem>
                </ShadcnAICSelectContent>
                <label
                  style={{
                    alignItems: "center",
                    display: "inline-flex",
                    gap: 10,
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  <ShadcnAICCheckbox {...SHOW_ARCHIVED_PROPS} />
                  Show archived accounts
                </label>
              </div>

              <div
                style={{
                  background: "#f8fbff",
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 18,
                  display: "grid",
                  gap: 12,
                  padding: 16
                }}
              >
                <h2 style={{ fontSize: 20, margin: 0 }}>Renewal note</h2>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <ShadcnAICInput
                    {...RENEWAL_NOTE_INPUT_PROPS}
                    placeholder="Capture the next follow-up note"
                    style={{ flex: "1 1 320px" }}
                  />
                  <ShadcnAICButton
                    {...SAVE_RENEWAL_NOTE_PROPS}
                    style={{
                      background: "#0f766e",
                      border: 0,
                      color: "white",
                      cursor: "pointer",
                      fontSize: 15
                    }}
                    type="button"
                  >
                    Save renewal note
                  </ShadcnAICButton>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <ShadcnAICTabsTrigger {...OVERVIEW_TAB_PROPS}>
                    Overview
                  </ShadcnAICTabsTrigger>
                  <AIC.Button
                    {...BILLING_TAB_PROPS}
                    style={{
                      background: "#e2e8f0",
                      border: 0,
                      borderRadius: 999,
                      color: "#0f172a",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: 700,
                      padding: "10px 16px"
                    }}
                    type="button"
                  >
                    Billing
                  </AIC.Button>
                </div>
                <ShadcnAICTabsContent {...OVERVIEW_PANEL_PROPS}>
                  Northwind Traders is on an annual enterprise contract with renewal due in 38
                  days.
                </ShadcnAICTabsContent>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Live runtime manifest</h2>
              <RuntimeManifestPreview />
            </div>
          </section>
        </div>
        <AICDevtoolsBridge
          pageTitle={CRM_VIEW.pageTitle}
          route_pattern={CRM_VIEW.route_pattern}
          url={CRM_VIEW.url}
          view_id={CRM_VIEW.view_id}
        />
        <AICDevtoolsOverlay
          pageTitle={CRM_VIEW.pageTitle}
          route_pattern={CRM_VIEW.route_pattern}
          url={CRM_VIEW.url}
          view_id={CRM_VIEW.view_id}
        />
      </main>
    </AICProvider>
  );
}
