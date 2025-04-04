import express from "express";
import { auth } from "../middleware/auth";
import {
  getTransactionById,
  getUserTransactions,
  processPayment,
  cancelTransaction,
  completeTransaction,
  disputeTransaction,
  addPaymentMethod,
  getPaymentMethods,
  deletePaymentMethod
} from "../controllers/transactionController";

const router = express.Router();

// Transaction endpoints
router.get("/", auth, getUserTransactions);
router.get("/:id", auth, getTransactionById);
router.post("/process-payment", auth, processPayment);
router.put("/:id/cancel", auth, cancelTransaction);
router.put("/:id/complete", auth, completeTransaction);
router.put("/:id/dispute", auth, disputeTransaction);

// Payment method endpoints
router.post("/payment-methods", auth, addPaymentMethod);
router.get("/payment-methods", auth, getPaymentMethods);
router.delete("/payment-methods/:id", auth, deletePaymentMethod);

export default router;