const bcrypt = require("bcrypt");
const { Strategy: LocalStrategy } = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/User");

function configurePassport(passport) {
  passport.use(
    "local",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password"
      },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email: email.toLowerCase().trim() });

          if (!user || !user.passwordHash) {
            return done(null, false, {
              message: "No local account was found with these credentials."
            });
          }

          const isMatch = await bcrypt.compare(password, user.passwordHash);

          if (!isMatch) {
            return done(null, false, { message: "Invalid email or password." });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "missing-google-client-id",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "missing-google-client-secret",
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value.toLowerCase()
              : `${profile.id}@google-oauth.local`;

          let user = await User.findOne({
            $or: [
              { oauthProvider: "google", oauthId: profile.id },
              { email }
            ]
          });

          if (!user) {
            user = await User.create({
              email,
              name: profile.displayName,
              avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : "",
              oauthProvider: "google",
              oauthId: profile.id,
              authMethods: ["oauth"]
            });
          } else {
            user.name = user.name || profile.displayName;
            user.avatar = user.avatar || (profile.photos && profile.photos[0] ? profile.photos[0].value : "");
            user.oauthProvider = "google";
            user.oauthId = profile.id;

            if (!user.authMethods.includes("oauth")) {
              user.authMethods.push("oauth");
            }

            await user.save();
          }

          user.currentAuthMethod = "oauth";
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, { id: user.id, currentAuthMethod: user.currentAuthMethod || "session" });
  });

  passport.deserializeUser(async (sessionUser, done) => {
    try {
      const user = await User.findById(sessionUser.id);
      if (user) {
        user.currentAuthMethod = sessionUser.currentAuthMethod || "session";
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

module.exports = configurePassport;
