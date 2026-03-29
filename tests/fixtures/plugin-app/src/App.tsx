import {
  ShadcnAICDialogContent,
  ShadcnAICDropdownMenuContent,
  ShadcnAICDropdownMenuItem,
  ShadcnAICDropdownMenuTrigger,
  ShadcnAICSelectItem
} from "@aic/integrations-shadcn";
import { importedAgentId } from "./external";

const agentTokens = {
  archive: {
    action: "click",
    id: "customer.archive",
    risk: "high"
  },
  view: {
    description: "View customer",
    id: `customer.view`
  }
};

const archiveIdAlias = agentTokens.archive.id;
const archiveId = archiveIdAlias;
const archiveRisk = agentTokens.archive.risk;
const withComputedKey = {
  ["badId"]: "customer.computed"
};
const withArgs = (suffix: string) => `customer.${suffix}`;
const dynamicId = Math.random() > 0.5 ? "customer.dynamic_a" : "customer.dynamic_b";

function getViewId() {
  return agentTokens.view.id;
}

const getViewDescription = () => agentTokens.view.description;
const getViewNavigationAction = () => `navigate`;

export function App() {
  return (
    <main>
      <ShadcnAICDropdownMenuTrigger
        agentId="customer.actions"
        agentDescription="Open customer actions"
        agentAction="click"
        agentRisk="low"
      >
        Customer actions
      </ShadcnAICDropdownMenuTrigger>
      <ShadcnAICDropdownMenuContent
        agentId="customer.actions.menu"
        agentDescription="Read customer actions menu"
        agentAction="read"
        agentRisk="low"
        agentRole="menu"
      >
        Menu content
      </ShadcnAICDropdownMenuContent>
      <ShadcnAICDropdownMenuItem
        agentId={archiveId}
        agentDescription="Archive customer"
        agentAction={agentTokens.archive.action}
        agentRisk={archiveRisk}
        agentRole="menuitem"
      >
        Archive customer
      </ShadcnAICDropdownMenuItem>
      <ShadcnAICDialogContent
        agentId="customer.archive.dialog"
        agentDescription="Archive customer dialog"
        agentAction="read"
        agentRisk="medium"
        agentRole="dialog"
      >
        Review archive impact
      </ShadcnAICDialogContent>
      <ShadcnAICSelectItem
        agentId={getViewId()}
        agentDescription={getViewDescription()}
        agentAction="select"
        agentRisk="low"
        agentRole="option"
      >
        View customer
      </ShadcnAICSelectItem>
      <button data-testid="send-renewal">Send renewal email</button>
      <button agentId={importedAgentId} agentDescription="Imported unsupported control">
        Skip imported
      </button>
      <button agentId={withComputedKey.badId} agentDescription="Computed key unsupported">
        Skip computed
      </button>
      <button agentId={withArgs("helper")} agentDescription="Helper args unsupported">
        Skip helper args
      </button>
      <button agentId={dynamicId} agentDescription="Skipped dynamic control">
        Skip dynamic
      </button>
    </main>
  );
}
