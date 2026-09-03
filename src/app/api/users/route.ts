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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    return NextResponse.json(users);
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

    // Create user with password
    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email,
        fullName,
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
        fullName: true,
        role: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (e) {
    console.error("Error creating user:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
