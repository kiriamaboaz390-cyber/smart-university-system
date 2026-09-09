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

    // `User` has no `fullName` column — the real columns are `firstName`/`lastName`,
    // so we select those and derive `fullName` for the response shape.
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: targetUser.id,
      email: targetUser.email,
      fullName: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
      role: targetUser.role,
    });
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
    const { fullName, firstName, lastName, role, password } = body;

    // `fullName` is not a column: accept it and split into the real columns
    // (`firstName`/`lastName`), or take explicit names when provided.
    const updateData: { firstName?: string; lastName?: string; role?: string } = {};
    if (fullName) {
      const [first, ...rest] = String(fullName).trim().split(/\s+/);
      if (first) updateData.firstName = first;
      if (rest.length > 0) updateData.lastName = rest.join(" ");
    }
    if (firstName) updateData.firstName = String(firstName).trim();
    if (lastName) updateData.lastName = String(lastName).trim();
    if (role) updateData.role = role;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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

    await prisma.auditLog.create({
      data: {
        actorId: user.userId,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: id,
        details: JSON.stringify({ fields: Object.keys(updateData) }),
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
      role: updatedUser.role,
    });
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
