import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: process.env.CALLBACK_URL || "http://localhost:5051/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Find or create user
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
          include: { companies: true },
        });

        if (!user) {
          // Create new user
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              name: profile.displayName || "Unknown",
              email: profile.emails?.[0]?.value || "",
              companies: {
                create: {
                  name: `${profile.displayName || "My"} Company`,
                },
              },
            },
            include: { companies: true },
          });
        }

        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

// Serialize user to session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { companies: true },
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;

