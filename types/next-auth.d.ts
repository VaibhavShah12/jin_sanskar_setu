import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: "ADMIN" | "VOLUNTEER" | "TRUSTEE";
      status: "ACTIVE" | "DISABLED";
      sanghId: string | null;
      sanghName: string | null;
      sanghPrefix: string | null;
      canExport: boolean;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: "ADMIN" | "VOLUNTEER" | "TRUSTEE";
    status: "ACTIVE" | "DISABLED";
    sanghId: string | null;
    sanghName: string | null;
    sanghPrefix: string | null;
    canExport: boolean;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: "ADMIN" | "VOLUNTEER" | "TRUSTEE";
    status?: "ACTIVE" | "DISABLED";
    sanghId?: string | null;
    sanghName?: string | null;
    sanghPrefix?: string | null;
    canExport?: boolean;
    mustChangePassword?: boolean;
  }
}
