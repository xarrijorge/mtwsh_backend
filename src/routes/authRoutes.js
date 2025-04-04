import express from "express";
import { 
  registerUser, 
  loginUser, 
  verifyUser, 
  getUserProfile, 
  updateUserProfile 
} from "../controllers/authController";
import { authenticate, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes
router.post("/verify", authenticate, verifyUser);
router.get("/profile", authenticate, getUserProfile);
router.put("/profile", authenticate, updateUserProfile);

// Admin-only route
router.get("/admin-dashboard", authenticate, authorize(["ADMIN"]), (req, res) => {
  return res.json({ message: "Welcome, Admin!" });
});

export default router;