import express from "express";
import { createAuction, getAuctions, getAuctionById, placeBid } from "../controllers/auctionController";
import { authenticate, authorize } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", authenticate, authorize(["seller"]), createAuction);
router.get("/", getAuctions);
router.get("/:id", getAuctionById);
router.post("/:id/bid", authenticate, authorize(["buyer"]), placeBid);

export default router;
