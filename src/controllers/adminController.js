import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req, res) => {
  try {
    // Get counts of various entities for dashboard
    const [
      userCount,
      auctionCount,
      openAuctionsCount,
      soldAuctionsCount,
      transactionCount,
      pendingTransactionsCount,
      recentUsersCount,
      totalBidsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.auction.count(),
      prisma.auction.count({ where: { status: "OPEN" } }),
      prisma.auction.count({ where: { status: "SOLD" } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.bid.count()
    ]);

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        auction: { select: { title: true } },
        seller: { select: { username: true } },
        buyer: { select: { username: true } }
      }
    });

    return res.json({
      stats: {
        userCount,
        auctionCount,
        openAuctionsCount,
        soldAuctionsCount,
        transactionCount,
        pendingTransactionsCount,
        recentUsersCount,
        totalBidsCount
      },
      recentTransactions
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Error fetching dashboard stats", error: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { 
      role, 
      isVerified, 
      search, 
      sortBy = "createdAt", 
      sortOrder = "desc",
      page = 1, 
      limit = 20 
    } = req.query;

    // Build filter conditions
    const where = {};
    
    if (role) where.role = role;
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isVerified: true,
          profileImage: true,
          createdAt: true,
          lastLogin: true,
          loginCount: true,
          _count: {
            select: {
              auctions: true,
              bids: true,
              reviews: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    return res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Error fetching users", error: error.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;
    
    const user = await prisma.user.update({
      where: { id },
      data: { isVerified },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isVerified: true
      }
    });
    
    return res.json({ message: "User status updated successfully", user });
  } catch (error) {
    console.error("Error updating user status:", error);
    return res.status(500).json({ message: "Error updating user status", error: error.message });
  }
};

export const manageAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, featured } = req.body;
    
    // Validate input
    if (status && !["DRAFT", "OPEN", "CLOSED", "SOLD", "CANCELED"].includes(status)) {
      return res.status(400).json({ message: "Invalid auction status" });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (featured !== undefined) updateData.featured = featured;
    
    const auction = await prisma.auction.update({
      where: { id },
      data: updateData
    });
    
    return res.json({ message: "Auction updated successfully", auction });
  } catch (error) {
    console.error("Error managing auction:", error);
    return res.status(500).json({ message: "Error managing auction", error: error.message });
  }
};

export const manageTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate input
    if (!["PENDING", "PAID", "COMPLETED", "REFUNDED", "DISPUTED", "CANCELED"].includes(status)) {
      return res.status(400).json({ message: "Invalid transaction status" });
    }
    
    const transaction = await prisma.transaction.update({
      where: { id },
      data: { 
        status,
        completedAt: ["COMPLETED", "REFUNDED"].includes(status) ? new Date() : null
      },
      include: {
        auction: true,
        seller: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        buyer: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // If transaction is completed, update auction status
    if (status === "COMPLETED") {
      await prisma.auction.update({
        where: { id: transaction.auctionId },
        data: { status: "SOLD" }
      });
    }
    
    // Create notifications for both buyer and seller
    await Promise.all([
      prisma.notification.create({
        data: {
          userId: transaction.sellerId,
          type: "SYSTEM",
          message: `Transaction for "${transaction.auction.title}" has been updated to ${status}`,
          auctionId: transaction.auctionId
        }
      }),
      prisma.notification.create({
        data: {
          userId: transaction.buyerId,
          type: "SYSTEM",
          message: `Transaction for "${transaction.auction.title}" has been updated to ${status}`,
          auctionId: transaction.auctionId
        }
      })
    ]);
    
    return res.json({ message: "Transaction updated successfully", transaction });
  } catch (error) {
    console.error("Error managing transaction:", error);
    return res.status(500).json({ message: "Error managing transaction", error: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        parent: true,
        _count: {
          select: { auctions: true }
        }
      }
    });
    
    return res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Error fetching categories", error: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, parentId } = req.body;
    
    const category = await prisma.category.create({
      data: {
        name,
        description,
        parentId
      }
    });
    
    return res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({ message: "Error creating category", error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId } = req.body;
    
    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        description,
        parentId
      }
    });
    
    return res.json(category);
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({ message: "Error updating category", error: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has auctions
    const auctionCount = await prisma.auction.count({
      where: { categoryId: id }
    });
    
    if (auctionCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with existing auctions. Reassign auctions first." 
      });
    }
    
    // Check if category has subcategories
    const subcategoryCount = await prisma.category.count({
      where: { parentId: id }
    });
    
    if (subcategoryCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete category with existing subcategories. Delete or reassign subcategories first." 
      });
    }
    
    await prisma.category.delete({
      where: { id }
    });
    
    return res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ message: "Error deleting category", error: error.message });
  }
};

export const getPendingAuctions = async (req, res) => {
    try {
      const auctions = await prisma.auction.findMany({
        where: { status: "DRAFT" },
        include: {
          seller: {
            select: { username: true, email: true }
          },
          category: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
  
      return res.json(auctions);
    } catch (error) {
      console.error("Error fetching pending auctions:", error);
      return res.status(500).json({ message: "Error fetching pending auctions", error: error.message });
    }
  };
