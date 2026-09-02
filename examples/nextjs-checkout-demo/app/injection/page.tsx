"use client";

import { AICProvider } from "@aicorg/sdk-react/client";
import { InjectionDemoContent } from "./InjectionDemoContent";

export default function Page() {
  return (
    <AICProvider>
      <InjectionDemoContent />
    </AICProvider>
  );
}
