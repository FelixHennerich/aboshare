import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSubscription,
  getUserForSession,
  listSubscriptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user)
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  return NextResponse.json({
    subscriptions: await listSubscriptions(
      user.role === "user" ? user.id : undefined,
    ),
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getUserForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (user?.role !== "admin")
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  const body = await request.json().catch(() => null);
  try {
    await createSubscription(String(body?.name ?? ""));
    return NextResponse.json(
      { subscriptions: await listSubscriptions() },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Abo konnte nicht angelegt werden.",
      },
      { status: 400 },
    );
  }
}
