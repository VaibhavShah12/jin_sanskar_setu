import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Username & Password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("USERNAME_REQUIRED");
        }

        const username = credentials.username.trim().toLowerCase();

        try {
          const dbUser = await prisma.user.findUnique({
            where: { username },
            include: { sangh: true },
          });

          if (!dbUser) {
            throw new Error("INVALID_CREDENTIALS");
          }

          if (dbUser.status !== "ACTIVE") {
            throw new Error("ACCOUNT_DISABLED");
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            dbUser.passwordHash
          );

          if (!passwordMatch) {
            throw new Error("INVALID_CREDENTIALS");
          }

          // Update last login timestamp
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: dbUser.id,
            name: dbUser.name || dbUser.username,
            email: dbUser.email || dbUser.username, // NextAuth requires email field
            // Custom fields passed through token
            username: dbUser.username,
            role: dbUser.role,
            status: dbUser.status,
            sanghId: dbUser.sanghId,
            sanghName: dbUser.sangh?.name || null,
            sanghPrefix: dbUser.sangh?.prefix || null,
            canExport: dbUser.canExport ?? false,
            mustChangePassword: dbUser.mustChangePassword ?? false,
          } as any;
        } catch (error: any) {
          // Re-throw known errors
          if (
            error.message === "INVALID_CREDENTIALS" ||
            error.message === "ACCOUNT_DISABLED" ||
            error.message === "USERNAME_REQUIRED"
          ) {
            throw error;
          }
          console.error("[AUTH ERROR] Database error during authorization:", error);
          throw new Error("DATABASE_ERROR");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First sign-in: populate token from authorize() return
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.status = (user as any).status;
        token.sanghId = (user as any).sanghId;
        token.sanghName = (user as any).sanghName;
        token.sanghPrefix = (user as any).sanghPrefix;
        token.canExport = (user as any).canExport ?? false;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      } else if (token.username) {
        // Subsequent requests: re-validate against DB to catch disabled users
        try {
          const dbUser = await prisma.user.findUnique({
            where: { username: token.username as string },
            include: { sangh: true },
          });

          if (dbUser && dbUser.status === "ACTIVE") {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.status = dbUser.status;
            token.sanghId = dbUser.sanghId;
            token.sanghName = dbUser.sangh?.name || null;
            token.sanghPrefix = dbUser.sangh?.prefix || null;
            token.canExport = dbUser.canExport ?? false;
            token.mustChangePassword = dbUser.mustChangePassword ?? false;
          } else {
            token.status = "DISABLED";
          }
        } catch {
          // Keep existing token values if DB is temporarily unreachable
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as "ADMIN" | "VOLUNTEER" | "TRUSTEE";
        session.user.status = token.status as "ACTIVE" | "DISABLED";
        session.user.sanghId = token.sanghId as string | null;
        session.user.sanghName = token.sanghName as string | null;
        session.user.sanghPrefix = token.sanghPrefix as string | null;
        session.user.canExport = !!token.canExport;
        session.user.mustChangePassword = !!token.mustChangePassword;
      }
      return session;
    },
  },
};
