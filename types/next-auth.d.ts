import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: "ADMIN" | "VOLUNTEER";
      status: "ACTIVE" | "DISABLED";
      sanghId: string | null;
      sanghName: string | null;
      sanghPrefix: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    username: string;
    role: "ADMIN" | "VOLUNTEER";
    status: "ACTIVE" | "DISABLED";
    sanghId: string | null;
    sanghName: string | null;
    sanghPrefix: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: "ADMIN" | "VOLUNTEER";
    status?: "ACTIVE" | "DISABLED";
    sanghId?: string | null;
    sanghName?: string | null;
    sanghPrefix?: string | null;
  }
}
