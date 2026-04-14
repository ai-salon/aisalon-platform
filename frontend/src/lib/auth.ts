import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// API_URL is a server-only env var (read at runtime); falls back to the
// build-time NEXT_PUBLIC_API_URL for local dev.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: credentials.identifier,
              password: credentials.password,
            }),
          });
          if (!res.ok) return null;
          const { access_token } = await res.json();

          // Fetch user info
          const me = await fetch(`${API_URL}/admin/me`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          if (!me.ok) return null;
          const user = await me.json();

          return { ...user, accessToken: access_token };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.role = (user as any).role;
        token.chapterId = (user as any).chapter_id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session.user as any).role = token.role;
      (session.user as any).chapterId = token.chapterId;
      (session.user as any).username = token.username;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
});
