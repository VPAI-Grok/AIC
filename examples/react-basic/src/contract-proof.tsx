import { AICButton, AICInput } from "@aicorg/sdk-react";

export function ContractProof() {
  return (
    <>
      <AICButton
        agentAction="click"
        agentDescription="Opens the archive confirmation dialog for the selected customer"
        agentId="customer.archive"
        agentRisk="high"
      >
        Archive customer
      </AICButton>
      <AICButton
        agentAction="click"
        agentDescription="Sends a renewal reminder email to the current customer"
        agentId="customer.send_renewal_email"
        agentRisk="medium"
      >
        Send renewal reminder
      </AICButton>
      <AICInput
        agentDescription="Captures the next renewal follow-up note for the selected customer"
        agentId="customer.renewal_note"
        agentLabel="Renewal note"
        agentRisk="low"
      />
      <AICButton
        agentAction="submit"
        agentDescription="Stores the current renewal note on the customer record"
        agentId="customer.renewal_note.save"
        agentRisk="medium"
      >
        Save renewal note
      </AICButton>
    </>
  );
}
