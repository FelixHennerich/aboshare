import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserForSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

function workerHeaders() {
  return { Authorization: `Bearer ${process.env.MAIL_WORKER_TOKEN ?? ""}` };
}

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (user?.role !== "admin")
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  const workerUrl = process.env.MAIL_WORKER_URL;
  if (!workerUrl)
    return NextResponse.json(
      { error: "Mailworker ist nicht konfiguriert." },
      { status: 503 },
    );
  try {
    const response = await fetch(`${workerUrl}/mails`, {
      headers: workerHeaders(),
      cache: "no-store",
    });
    if (!response.ok)
      return NextResponse.json(
        { error: "Gmail konnte nicht abgerufen werden." },
        { status: 502 },
      );
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(
      { error: "Mailworker ist nicht erreichbar." },
      { status: 502 },
    );
  }
}
