import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const result = await authenticateUser(email, password);
    if (!result) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

    return NextResponse.json({ token: result.token, user: result.user });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
