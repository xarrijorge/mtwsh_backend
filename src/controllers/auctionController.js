import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createAuction = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      condition, 
      images, 
      startingBid, 
      buyNowPrice,
      reservePrice,
      minBidIncrement,
      categoryId,
      tags,
      endsAt 
    } = req.body;
    
    const sellerId = req.user?.id;

    // Validate condition enum
    const validConditions = [
      "NEW", "USED_LIKE_NEW", "USED_VERY_GOOD", 
      "USED_GOOD", "USED_ACCEPTABLE", "FOR_PARTS", 
      "REFURBISHED", "OPEN_BOX"
    ];
    
    if (!validConditions.includes(condition)) {
      return res.status(400).json({ message: "Invalid condition specified" });
    }

    const auction = await prisma.auction.create({
      data: { 
        title, 
        description, 
        condition,
        images, 
        startingBid, 
        buyNowPrice,
        reservePrice,
        minBidIncrement: minBidIncrement || 1.00,
        categoryId,
        tags: tags || [],
        endsAt, 
        sellerId,
        status: "OPEN"
      },
    });

    return res.status(201).json(auction);
  } catch (error) {
    console.error("Error creating auction:", error);
    return res.status(500).json({ message: "Error creating auction", error: error.message });
  }
};

export const getAuctions = async (req, res) => {
  try {
    const { 
      status, 
      categoryId, 
      condition, 
      minPrice, 
      maxPrice,
      search,
      sellerId,
      featured,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20
    } = req.query;

    // Build filter conditions
    const where = { status: status || "OPEN" };
    
    if (categoryId) where.categoryId = categoryId;
    if (condition) where.condition = condition;
    if (sellerId) where.sellerId = sellerId;
    if (featured === 'true') where.featured = true;
    
    // Price range filtering
    if (minPrice || maxPrice) {
      where.startingBid = {};
      if (minPrice) where.startingBid.gte = parseFloat(minPrice);
      if (maxPrice) where.startingBid.lte = parseFloat(maxPrice);
    }
    
    // Text search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get auctions with pagination
    const [auctions, totalCount] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: { 
          bids: { 
            take: 1,
            orderBy: { amount: 'desc' }
          },
          category: true,
          seller: {
            select: {
              id: true,
              username: true,
              profileImage: true,
              isVerified: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.auction.count({ where })
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    return res.json({
      auctions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return res.status(500).json({ message: "Error fetching auctions", error: error.message });
  }
};

export const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Increment the view counter
    await prisma.auction.update({
      where: { id },
      data: { views: { increment: 1 } }
    });
    
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: { 
        bids: {
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
                profileImage: true,
                isVerified: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        seller: {
          select: {
            id: true,
            username: true,
            profileImage: true,
            isVerified: true,
            _count: {
              select: {
                auctions: true,
                reviews: true
              }
            }
          }
        },
        category: true
      },
    });

    if (!auction) return res.status(404).json({ message: "Auction not found" });

    return res.json(auction);
  } catch (error) {
    console.error("Error fetching auction:", error);
    return res.status(500).json({ message: "Error fetching auction", error: error.message });
  }
};

export const getAuctionsBySellerID = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = { sellerId: id };
    if (status) where.status = status;
    
    const [auctions, totalCount] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: { 
          bids: {
            take: 1,
            orderBy: { amount: 'desc' }
          },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auction.count({ where })
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    if (auctions.length === 0 && page === 1)
      return res.status(404).json({ message: "No auctions found for this seller" });

    return res.json({
      auctions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching seller auctions:", error);
    return res.status(500).json({ message: "Error fetching auctions", error: error.message });
  }
};

export const updateAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user?.id;
    const { 
      title, 
      description, 
      condition,
      images,
      buyNowPrice,
      reservePrice,
      categoryId,
      tags
    } = req.body;
    
    // Check if auction exists and belongs to seller
    const auction = await prisma.auction.findUnique({
      where: { id }
    });
    
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }
    
    if (auction.sellerId !== sellerId) {
      return res.status(403).json({ message: "Not authorized to update this auction" });
    }
    
    // Check if auction can be updated (not closed or sold)
    if (auction.status !== "OPEN" && auction.status !== "DRAFT") {
      return res.status(400).json({ 
        message: "Cannot update auction that is closed, sold, or canceled" 
      });
    }
    
    // Prepare update data
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (condition) updateData.condition = condition;
    if (images) updateData.images = images;
    if (buyNowPrice !== undefined) updateData.buyNowPrice = buyNowPrice;
    if (reservePrice !== undefined) updateData.reservePrice = reservePrice;
    if (categoryId) updateData.categoryId = categoryId;
    if (tags) updateData.tags = tags;
    
    const updatedAuction = await prisma.auction.update({
      where: { id },
      data: updateData
    });
    
    return res.json(updatedAuction);
  } catch (error) {
    console.error("Error updating auction:", error);
    return res.status(500).json({ message: "Error updating auction", error: error.message });
  }
};

export const placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const bidderId = req.user?.id;

    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1
        }
      }
    });

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }
    
    if (auction.status !== "OPEN") {
      return res.status(400).json({ message: "Auction is not open for bidding" });
    }
    
    // Check if auction end date has passed
    if (new Date(auction.endsAt) < new Date()) {
      await prisma.auction.update({
        where: { id },
        data: { status: "CLOSED" }
      });
      return res.status(400).json({ message: "Auction has ended" });
    }
    
    // Check if seller is trying to bid on their own auction
    if (auction.sellerId === bidderId) {
      return res.status(400).json({ message: "Cannot bid on your own auction" });
    }

    const currentHighestBid = auction.highestBid || auction.startingBid;
    const minIncrement = auction.minBidIncrement || 1.00;
    
    // Ensure bid meets minimum required amount
    if (parseFloat(amount) < parseFloat(currentHighestBid) + parseFloat(minIncrement)) {
      return res.status(400).json({ 
        message: `Bid must be at least ${parseFloat(currentHighestBid) + parseFloat(minIncrement)}` 
      });
    }

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Mark previous highest bid as outbid
      if (auction.bids.length > 0) {
        await prisma.bid.update({
          where: { id: auction.bids[0].id },
          data: { status: "OUTBID" }
        });
        
        // Create notification for outbid user
        await prisma.notification.create({
          data: {
            userId: auction.bids[0].bidderId,
            type: "OUTBID",
            message: `You've been outbid on "${auction.title}"`,
            auctionId: auction.id
          }
        });
      }
      
      // Create the new bid
      const bid = await prisma.bid.create({
        data: { 
          amount, 
          auctionId: id, 
          bidderId,
          status: "WINNING"
        },
        include: {
          bidder: {
            select: {
              username: true,
              profileImage: true
            }
          }
        }
      });
      
      // Update auction with new highest bid
      await prisma.auction.update({
        where: { id },
        data: { highestBid: amount }
      });
      
      // Create notification for seller
      await prisma.notification.create({
        data: {
          userId: auction.sellerId,
          type: "SYSTEM",
          message: `New bid placed on your auction "${auction.title}"`,
          auctionId: auction.id
        }
      });
      
      return bid;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error placing bid:", error);
    return res.status(500).json({ message: "Error placing bid", error: error.message });
  }
};

export const getBidsByBidderId = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query filter
    const where = { bidderId: id };
    if (status) where.status = status;
    
    const [bids, totalCount] = await Promise.all([
      prisma.bid.findMany({
        where,
        include: { 
          auction: {
            include: {
              seller: {
                select: {
                  username: true,
                  profileImage: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.bid.count({ where })
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    if (bids.length === 0 && page === 1)
      return res.status(404).json({ message: "No bids found for this bidder" });

    return res.json({
      bids,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return res.status(500).json({ message: "Error fetching bids", error: error.message });
  }
};

export const closeAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user?.id;
    
    // Check if auction exists and belongs to seller
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: {
            bidder: true
          }
        }
      }
    });
    
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }
    
    // Verify the user is the seller or admin
    if (auction.sellerId !== sellerId && req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Not authorized to close this auction" });
    }
    
    if (auction.status !== "OPEN") {
      return res.status(400).json({ message: "Auction is already closed" });
    }

    const result = await prisma.$transaction(async (prisma) => {
      // Close the auction
      const updatedAuction = await prisma.auction.update({
        where: { id },
        data: { status: "CLOSED" }
      });
      
      // If there's a winning bid, create a transaction and notify the winner
      if (auction.bids.length > 0) {
        const winningBid = auction.bids[0];
        
        // Create transaction record
        await prisma.transaction.create({
          data: {
            auctionId: auction.id,
            sellerId: auction.sellerId,
            buyerId: winningBid.bidderId,
            amount: winningBid.amount,
            status: "PENDING"
          }
        });
        
        // Notify the winner
        await prisma.notification.create({
          data: {
            userId: winningBid.bidderId,
            type: "AUCTION_WON",
            message: `Congratulations! You won the auction for "${auction.title}"`,
            auctionId: auction.id
          }
        });
      }
      
      return updatedAuction;
    });

    return res.json({ message: "Auction closed successfully", auction: result });
  } catch (error) {
    console.error("Error closing auction:", error);
    return res.status(500).json({ message: "Error closing auction", error: error.message });
  }
};

export const addToWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Check if auction exists
    const auction = await prisma.auction.findUnique({
      where: { id }
    });
    
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }
    
    // Check if already in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_auctionId: {
          userId,
          auctionId: id
        }
      }
    });
    
    if (existing) {
      return res.status(400).json({ message: "Auction already in watchlist" });
    }
    
    // Add to watchlist
    await prisma.watchlist.create({
      data: {
        userId,
        auctionId: id
      }
    });
    
    return res.status(201).json({ message: "Added to watchlist successfully" });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    return res.status(500).json({ message: "Error adding to watchlist", error: error.message });
  }
};

export const removeFromWatchlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Delete from watchlist
    await prisma.watchlist.delete({
      where: {
        userId_auctionId: {
          userId,
          auctionId: id
        }
      }
    });
    
    return res.json({ message: "Removed from watchlist successfully" });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    
    // If not found, return appropriate error
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Auction not found in watchlist" });
    }
    
    return res.status(500).json({ message: "Error removing from watchlist", error: error.message });
  }
};

export const getWatchlist = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [watchlist, totalCount] = await Promise.all([
      prisma.watchlist.findMany({
        where: { userId },
        include: {
          auction: {
            include: {
              seller: {
                select: {
                  username: true,
                  profileImage: true
                }
              },
              bids: {
                take: 1,
                orderBy: { amount: 'desc' }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.watchlist.count({ where: { userId } })
    ]);
    
    // Calculate total pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    if (watchlist.length === 0 && page === 1) {
      return res.status(404).json({ message: "No items in watchlist" });
    }
    
    return res.json({
      watchlist,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return res.status(500).json({ message: "Error fetching watchlist", error: error.message });
  }
};