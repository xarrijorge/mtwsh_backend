import express from "express";
import {
  createAuction,
  getAuctions,
  getAuctionById,
  getAuctionsBySellerID,
  updateAuction,
  closeAuction,
  placeBid,
  getBidsByBidderId,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist
} from "../controllers/auctionController";

import { authenticate, authorize } from "../middleware/authMiddleware";

const router = express.Router();

// Auctions
router.post("/", authenticate, authorize(["SELLER"]), createAuction);
router.get("/", getAuctions);
router.get("/:id", getAuctionById);
router.put("/:id", authenticate, authorize(["SELLER"]), updateAuction);
router.put("/:id/close", authenticate, authorize(["SELLER", "ADMIN"]), closeAuction);

// Seller listings
router.get("/seller/:id", getAuctionsBySellerID);

// Bidding
router.post("/:id/bid", authenticate, authorize(["BUYER"]), placeBid);
router.get("/bids/user/:id", authenticate, getBidsByBidderId);

// Watchlist
router.post("/:id/watch", authenticate, addToWatchlist);
router.delete("/:id/watch", authenticate, removeFromWatchlist);
router.get("/watchlist/me", authenticate, getWatchlist);

export default router;