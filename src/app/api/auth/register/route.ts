import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, firstName, lastName, password, role } = body;
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const user = await registerUser({ email, firstName, lastName, password, role });
    return NextResponse.json({ user });
  } catch (err: any) {
    const code = err?.message || "error";
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
