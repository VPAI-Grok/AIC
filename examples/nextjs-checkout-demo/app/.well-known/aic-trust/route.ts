import registry from "../../../../../registry/index.json";

export function GET() {
  return Response.json(registry, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
      "X-AIC-Registry-Status": "discovery-only"
    }
  });
}
