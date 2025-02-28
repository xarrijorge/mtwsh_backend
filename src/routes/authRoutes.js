import express from "express";
import { registerUser, loginUser } from "../controllers/authController";
import { authenticate, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// Register and login
router.post("/register", registerUser);
router.post("/login", loginUser);

// Admin-only route
router.get("/admin-dashboard", authenticate, authorize(["admin"]), (req, res) => {
  return res.json({ message: "Welcome, Admin!" });
});

export default router;