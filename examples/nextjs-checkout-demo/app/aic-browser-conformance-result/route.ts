import result from "../../aic-browser-conformance-result.json";

export function GET() {
  return Response.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
