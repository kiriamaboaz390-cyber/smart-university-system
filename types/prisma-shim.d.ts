declare module "@prisma/client" {
  export class PrismaClient {
    constructor(options?: unknown);
  }

  // Model delegates (prisma.user, prisma.session, ...) are provided by the
  // generated client at runtime; keep typing intentionally loose here.
  export interface PrismaClient {
    [key: string]: any;
  }
}

