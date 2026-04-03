import { NextRequest, NextResponse } from "next/server";

const SPRING_URL = process.env.NEXT_PUBLIC_SPRING_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const response = await fetch(`${SPRING_URL}/api/v1/auth/register-shipper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-ID": requestId,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const backendRequestId = response.headers.get("x-request-id") ?? requestId;
    const text = await response.text();

    try {
      const json = text ? JSON.parse(text) : {};
      return NextResponse.json(json, {
        status: response.status,
        headers: {
          "X-Request-ID": backendRequestId,
        },
      });
    } catch {
      return NextResponse.json(
        {
          status: response.status,
          error: response.ok ? "OK" : "Upstream Error",
          message: text || "Empty response from Spring backend.",
          requestId: backendRequestId,
          path: "/api/auth/register-shipper",
        },
        {
          status: response.status,
          headers: {
            "X-Request-ID": backendRequestId,
          },
        }
      );
    }
  } catch {
    return NextResponse.json(
      {
        status: 502,
        error: "Bad Gateway",
        message: "Website could not reach the Spring backend.",
        requestId,
        path: "/api/auth/register-shipper",
      },
      {
        status: 502,
        headers: {
          "X-Request-ID": requestId,
        },
      }
    );
  }
}