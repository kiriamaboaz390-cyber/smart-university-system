import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

type JwtPayload = { userId: string; role: string };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signJwt(payload: JwtPayload) {
  const secret = process.env.JWT_SECRET || "dev-jwt-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyJwt(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "dev-jwt-secret";
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

export async function registerUser(opts: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: string;
}) {
  const { email, firstName, lastName, password, role = "STUDENT" } = opts;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("USER_EXISTS");

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      role,
    },
  });

  const passwordHash = await hashPassword(password);
  await prisma.authCredential.create({ data: { userId: user.id, passwordHash } });

  return user;
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const cred = await prisma.authCredential.findUnique({ where: { userId: user.id } });
  if (!cred) return null;

  const ok = await comparePassword(password, cred.passwordHash);
  if (!ok) return null;

  const token = signJwt({ userId: user.id, role: user.role });
  return { user, token };
}
