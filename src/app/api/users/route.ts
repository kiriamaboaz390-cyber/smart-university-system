import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only HR_ADMIN and SUPER_ADMIN can list users
    if (!hasRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // `User` has no `fullName` column — select firstName/lastName and
    // derive `fullName` for the response shape.
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return NextResponse.json(
      users.map(
        (u: { id: string; email: string; firstName: string; lastName: string; role: string }) => ({
          id: u.id,
          email: u.email,
          fullName: `${u.firstName} ${u.lastName}`.trim(),
          role: u.role,
        }),
      ),
    );
  } catch (e) {
    console.error("Error listing users:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only HR_ADMIN and SUPER_ADMIN can create users
    if (!hasRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, fullName, role } = body;

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, fullName, role" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["SUPER_ADMIN", "HR_ADMIN", "ADMIN", "LECTURER", "STUDENT"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    // Create user with password — split fullName into firstName/lastName columns
    const [first, ...rest] = String(fullName).trim().split(/\s+/);
    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email,
        firstName: first,
        lastName: rest.join(" "),
        role,
        authCredential: {
          create: {
            passwordHash,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        id: newUser.id,
        email: newUser.email,
        fullName: `${newUser.firstName} ${newUser.lastName}`.trim(),
        role: newUser.role,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("Error creating user:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
