import proof from "../../aic-browser-proof.json";

export function GET() {
  return Response.json(proof, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
