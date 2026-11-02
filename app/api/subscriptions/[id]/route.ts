import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  assignSubscription,
  getUserForSession,
  listSubscriptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const user = await getUserForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (user?.role !== "admin")
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const { id } = await context.params;
  try {
    await assignSubscription(
      id,
      String(body?.userId ?? ""),
      Number(body?.price),
    );
    return NextResponse.json({ subscriptions: await listSubscriptions() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Abo konnte nicht zugewiesen werden.",
      },
      { status: 400 },
    );
  }
}
