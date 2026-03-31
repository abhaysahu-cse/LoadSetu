const CONTROL_API_BASE_URL = process.env.CONTROL_API_BASE_URL ?? "http://127.0.0.1:8000";

async function fetchJson(path: string) {
  const response = await fetch(`${CONTROL_API_BASE_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return response.json();
}

export async function GET() {
  try {
    const [health, trucks, loadEvents, matchResults] = await Promise.all([
      fetchJson("/api/v1/admin/health"),
      fetchJson("/api/v1/admin/trucks/live"),
      fetchJson("/api/v1/admin/load-events/recent"),
      fetchJson("/api/v1/admin/load-matches/recent"),
    ]);

    return Response.json({
      fetchedAt: new Date().toISOString(),
      health,
      trucks,
      loadEvents,
      matchResults,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to load overview";
    return Response.json({ error: message }, { status: 502 });
  }
}