import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, hasRole } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";

interface Params {
  id: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(targetUser);
  } catch (e) {
    console.error("Error fetching user:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasRole(user, ["HR_ADMIN", "SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { fullName, role, password } = body;

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (role) updateData.role = role;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    // Update password separately if provided
    if (password) {
      const passwordHash = await hashPassword(password);
      await prisma.authCredential.update({
        where: { userId: id },
        data: { passwordHash },
      });
    }

    return NextResponse.json(updatedUser);
  } catch (e) {
    console.error("Error updating user:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const user = getUserFromAuthHeader(authHeader || undefined);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete users
    if (!hasRole(user, ["SUPER_ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error deleting user:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
