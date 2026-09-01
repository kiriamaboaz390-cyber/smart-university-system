type PrismaClientLike = any;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientLike;
};

async function getPrismaClient(): Promise<PrismaClientLike> {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const mod = await import("@prisma/client");
  const PrismaClient = (mod as any).PrismaClient ?? function PrismaClient() {
    return {};
  };

  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClientLike, {
  get: (_, prop) => {
    const clientPromise = getPrismaClient();
    return Reflect.get(clientPromise, prop);
  },
  apply: (_, __, args) => {
    const clientPromise = getPrismaClient();
    return Reflect.apply(clientPromise as any, undefined, args);
  },
});
