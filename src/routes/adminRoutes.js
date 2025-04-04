import express from "express";
import { 
  getDashboardStats, 
  getUsers, 
  updateUserStatus, 
  manageAuction, 
  manageTransaction,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from "../controllers/adminController";
import { authenticate, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// All admin routes require authentication and admin authorization
router.use(authenticate, authorize(["ADMIN"]));

// Dashboard stats
router.get("/dashboard", getDashboardStats);

// User management
router.get("/users", getUsers);
router.patch("/users/:id/verify", updateUserStatus);

// Auction management
router.patch("/auctions/:id", manageAuction);

// Transaction management
router.patch("/transactions/:id", manageTransaction);

// Category management
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Get all draft auctions
router.get("/auctions/pending", getPendingAuctions);
// Get all completed auctions

export default router;