import passport from "passport";



// Middleware to protect routes
export const authenticate = passport.authenticate("jwt", { session: false });

// Middleware to check user role
export const authorize = (roles) => {
  return (req, res, next) => {
    console.log("User Info from JWT:", req.user); // Debugging line

    if (!req.user) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    return next();
  };
};