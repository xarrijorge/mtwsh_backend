import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createAuction = async (req, res) => {
  try {
    const { title, description, images, startingBid, endsAt } = req.body;
    const sellerId = req.user?.id;

    const auction = await prisma.auction.create({
      data: { title, description, images, startingBid, endsAt, sellerId },
    });

    return res.status(201).json(auction);
  } catch (error) {
    return res.status(500).json({ message: "Error creating auction", error });
  }
};

export const getAuctions = async (_req, res) => {
  try {
    const auctions = await prisma.auction.findMany({
      where: { status: "OPEN" },
      include: { bids: true },
    });

    return res.json(auctions);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching auctions", error });
  }
};

export const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: { bids: true },
    });

    if (!auction) return res.status(404).json({ message: "Auction not found" });

    return res.json(auction);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching auction", error });
  }
};

export const placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const bidderId = req.user?.id;

    const auction = await prisma.auction.findUnique({ where: { id } });

    if (!auction || auction.status !== "OPEN")
      return res.status(400).json({ message: "Auction is closed or does not exist" });

    if (amount <= auction.highestBid)
      return res.status(400).json({ message: "Bid must be higher than current highest bid" });

    const bid = await prisma.bid.create({
      data: { amount, auctionId: id, bidderId },
    });

    await prisma.auction.update({
      where: { id },
      data: { highestBid: amount },
    });

    return res.status(201).json(bid);
  } catch (error) {
    return res.status(500).json({ message: "Error placing bid", error });
  }
};

export const closeAuction = async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await prisma.auction.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    return res.json({ message: "Auction closed successfully", auction });
  } catch (error) {
    return res.status(500).json({ message: "Error closing auction", error });
  }
};
