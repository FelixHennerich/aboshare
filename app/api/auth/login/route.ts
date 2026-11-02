import { NextResponse } from "next/server";
import { authenticate, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.password)
    return NextResponse.json(
      { error: "Benutzername und Passwort sind erforderlich." },
      { status: 400 },
    );
  const result = await authenticate(
    String(body.username),
    String(body.password),
  );
  if (!result)
    return NextResponse.json(
      { error: "Anmeldedaten sind nicht korrekt." },
      { status: 401 },
    );
  const response = NextResponse.json({ user: result.user });
  response.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
