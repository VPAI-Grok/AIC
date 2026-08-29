import result from "../../aic-conformance-result.json";

export function GET() {
  return Response.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
