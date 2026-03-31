const CONTROL_API_BASE_URL = process.env.CONTROL_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${CONTROL_API_BASE_URL}/api/v1/admin/force-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Force match proxy failed";
    return Response.json({ error: message }, { status: 502 });
  }
}