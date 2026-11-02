import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createUser,
  getUserForSession,
  listUsers,
  SESSION_COOKIE,
} from "@/lib/auth";

async function getAdmin() {
  const cookieStore = await cookies();
  return getUserForSession(cookieStore.get(SESSION_COOKIE)?.value);
}
export async function GET() {
  const user = await getAdmin();
  if (user?.role !== "admin")
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  return NextResponse.json({ users: await listUsers() });
}
export async function POST(request: Request) {
  const user = await getAdmin();
  if (user?.role !== "admin")
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.password)
    return NextResponse.json(
      { error: "Benutzername und Passwort sind erforderlich." },
      { status: 400 },
    );
  try {
    await createUser(String(body.username), String(body.password));
    return NextResponse.json({ users: await listUsers() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nutzer konnte nicht angelegt werden.",
      },
      { status: 400 },
    );
  }
}
