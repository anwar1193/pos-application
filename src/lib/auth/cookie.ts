import type { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

function baseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(response: NextResponse, token: string, expires: Date): void {
  response.cookies.set(SESSION_COOKIE, token, { ...baseOptions(), expires });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...baseOptions(), expires: new Date(0) });
}
