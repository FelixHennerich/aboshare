import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserForSession, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserForSession(cookieStore.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user });
}
