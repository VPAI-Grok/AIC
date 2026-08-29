import observations from "../../aic-browser-observations.json";

export function GET() {
  return Response.json(observations, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
