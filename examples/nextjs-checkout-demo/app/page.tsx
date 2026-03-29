"use client";

import { AICDevtoolsBridge } from "@aic/devtools/client";
import { AICProvider } from "@aic/sdk-react/client";
import { CheckoutDemoContent } from "./CheckoutDemoContent";
import { CHECKOUT_VIEW } from "./checkout-contract.mjs";

export default function Page() {
  return (
    <AICProvider>
      <main
        style={{
          display: "grid",
          gap: 24,
          margin: "0 auto",
          maxWidth: 860,
          padding: "56px 20px"
        }}
      >
        <CheckoutDemoContent />

        <AICDevtoolsBridge
          pageTitle={CHECKOUT_VIEW.pageTitle}
          route_pattern={CHECKOUT_VIEW.route_pattern}
          url={CHECKOUT_VIEW.url}
          view_id={CHECKOUT_VIEW.view_id}
        />
      </main>
    </AICProvider>
  );
}
