import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from "passport-jwt";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

const opts: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

passport.use(
  new JwtStrategy(opts, (payload, done) => {
    console.log("Decoded JWT Payload:", payload); // Debugging line

    try {
      if (!payload.userId) {
        return done(null, false);
      }

      return done(null, { id: payload.userId, role: payload.role });
    } catch (error) {
      return done(error, false);
    }
  })
);

export default passport;