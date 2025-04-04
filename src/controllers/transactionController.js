import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        auction: {
          include: {
            seller: {
              select: {
                id: true,
                username: true,
                profileImage: true,
                isVerified: true
              }
            }
          }
        },
        seller: {
          select: {
            id: true,
            username: true,
            profileImage: true,
            isVerified: true
          }
        },
        buyer: {
          select: {
            id: true,
            username: true,
            profileImage: true,
            isVerified: true
          }
        },
        shipment: true,
        paymentMethod: {
          select: {
            id: true,
            type: true,
            provider: true,
            accountNumber: true,
            expiryDate: true
          }
        }
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Check if user is authorized to view this transaction
    if (userId !== transaction.buyerId && userId !== transaction.sellerId && req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Not authorized to view this transaction" });
    }
    
    return res.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return res.status(500).json({ message: "Error fetching transaction", error: error.message });
  }
};

export const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { role, status, page = 1, limit = 20 } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause based on user role
    let where = {};
    
    if (role === "seller") {
      where.sellerId = userId;
    } else if (role === "buyer") {
      where.buyerId = userId;
    } else {
      // Default: show all transactions where user is either buyer or seller
      where.OR = [
        { sellerId: userId },
        { buyerId: userId }
      ];
    }
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          auction: {
            select: {
              id: true,
              title: true,
              images: true
            }
          },
          seller: {
            select: {
              id: true,
              username: true,
              profileImage: true
            }
          },
          buyer: {
            select: {
              id: true,
              username: true,
              profileImage: true
            }
          },
          shipment: {
            select: {
              status: true,
              trackingNumber: true,
              carrier: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.transaction.count({ where })
    ]);
    
    // Calculate total pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    
    if (transactions.length === 0 && page === 1) {
      return res.status(404).json({ message: "No transactions found" });
    }
    
    return res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ message: "Error fetching transactions", error: error.message });
  }
};

export const processPayment = async (req, res) => {
  try {
    const { transactionId, paymentMethodId } = req.body;
    const buyerId = req.user?.id;
    
    // Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { auction: true }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Verify user is the buyer
    if (transaction.buyerId !== buyerId) {
      return res.status(403).json({ message: "Not authorized to process this payment" });
    }
    
    // Check transaction status
    if (transaction.status !== "PENDING") {
      return res.status(400).json({ message: `Transaction is already ${transaction.status.toLowerCase()}` });
    }

    // Verify payment method belongs to user
    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId }
    });
    
    if (!paymentMethod || paymentMethod.userId !== buyerId) {
      return res.status(400).json({ message: "Invalid payment method" });
    }
    
    // In a real application, you would process payment through a payment gateway here
    // For this example, we'll simulate a successful payment
    
    // Update transaction status
    const updatedTransaction = await prisma.$transaction(async (prisma) => {
      // Update transaction
      const updatedTx = await prisma.transaction.update({
        where: { id: transactionId },
        data: { 
          status: "PAID",
          paymentMethodId
        }
      });
      
      // Update auction status to SOLD
      await prisma.auction.update({
        where: { id: transaction.auctionId },
        data: { status: "SOLD" }
      });
      
      // Create notification for seller
      await prisma.notification.create({
        data: {
          userId: transaction.sellerId,
          type: "PAYMENT_RECEIVED",
          message: `Payment received for "${transaction.auction.title}"`,
          auctionId: transaction.auctionId
        }
      });
      
      return updatedTx;
    });
    
    return res.json({ 
      message: "Payment processed successfully", 
      transaction: updatedTransaction 
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    return res.status(500).json({ message: "Error processing payment", error: error.message });
  }
};

export const cancelTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;
    
    // Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { auction: true }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Check if user is buyer, seller, or admin
    if (transaction.buyerId !== userId && transaction.sellerId !== userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Not authorized to cancel this transaction" });
    }
    
    // Only pending transactions can be canceled
    if (transaction.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending transactions can be canceled" });
    }
    
    // Perform the cancellation
    const result = await prisma.$transaction(async (prisma) => {
      // Update transaction status
      const updatedTransaction = await prisma.transaction.update({
        where: { id },
        data: { status: "CANCELED" }
      });
      
      // Reopen the auction
      await prisma.auction.update({
        where: { id: transaction.auctionId },
        data: { status: "OPEN" }
      });
      
      // Create notifications for both parties
      if (userId === transaction.buyerId) {
        // Buyer canceled
        await prisma.notification.create({
          data: {
            userId: transaction.sellerId,
            type: "SYSTEM",
            message: `Transaction for "${transaction.auction.title}" has been canceled by the buyer`,
            auctionId: transaction.auctionId
          }
        });
      } else if (userId === transaction.sellerId) {
        // Seller canceled
        await prisma.notification.create({
          data: {
            userId: transaction.buyerId,
            type: "SYSTEM",
            message: `Transaction for "${transaction.auction.title}" has been canceled by the seller`,
            auctionId: transaction.auctionId
          }
        });
      }
      
      return updatedTransaction;
    });
    
    return res.json({ 
      message: "Transaction canceled successfully", 
      transaction: result 
    });
  } catch (error) {
    console.error("Error canceling transaction:", error);
    return res.status(500).json({ message: "Error canceling transaction", error: error.message });
  }
};

export const completeTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { 
        auction: true,
        shipment: true
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Only the buyer can mark a transaction as complete
    if (transaction.buyerId !== userId) {
      return res.status(403).json({ message: "Only the buyer can complete this transaction" });
    }
    
    // Transaction must be in PAID status
    if (transaction.status !== "PAID") {
      return res.status(400).json({ message: "Transaction must be paid before it can be completed" });
    }
    
    // Ideally, also check if shipment is delivered
    if (transaction.shipment && transaction.shipment.status !== "DELIVERED") {
      return res.status(400).json({ message: "Wait until the item is delivered before completing the transaction" });
    }
    
    // Update transaction status
    const result = await prisma.$transaction(async (prisma) => {
      const completedTransaction = await prisma.transaction.update({
        where: { id },
        data: { 
          status: "COMPLETED",
          completedAt: new Date()
        }
      });
      
      // Create notifications
      await prisma.notification.create({
        data: {
          userId: transaction.sellerId,
          type: "SYSTEM",
          message: `Transaction for "${transaction.auction.title}" has been marked as completed`,
          auctionId: transaction.auctionId
        }
      });
      
      return completedTransaction;
    });
    
    return res.json({ 
      message: "Transaction completed successfully", 
      transaction: result 
    });
  } catch (error) {
    console.error("Error completing transaction:", error);
    return res.status(500).json({ message: "Error completing transaction", error: error.message });
  }
};

export const disputeTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: "Reason for dispute is required" });
    }
    
    // Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { auction: true }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Only buyer can dispute a transaction
    if (transaction.buyerId !== userId) {
      return res.status(403).json({ message: "Only the buyer can dispute this transaction" });
    }
    
    // Can only dispute PAID transactions
    if (transaction.status !== "PAID") {
      return res.status(400).json({ message: "Only paid transactions can be disputed" });
    }
    
    // Update transaction status
    const result = await prisma.$transaction(async (prisma) => {
      const disputedTransaction = await prisma.transaction.update({
        where: { id },
        data: { status: "DISPUTED" }
      });
      
      // Create notification for seller
      await prisma.notification.create({
        data: {
          userId: transaction.sellerId,
          type: "SYSTEM",
          message: `Transaction for "${transaction.auction.title}" has been disputed by the buyer`,
          auctionId: transaction.auctionId
        }
      });
      
      // In a real app, you would also create a dispute record
      // and notify customer support
      
      return disputedTransaction;
    });
    
    return res.json({ 
      message: "Transaction has been disputed", 
      transaction: result 
    });
  } catch (error) {
    console.error("Error disputing transaction:", error);
    return res.status(500).json({ message: "Error disputing transaction", error: error.message });
  }
};

export const addPaymentMethod = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { type, provider, accountNumber, expiryDate, isDefault } = req.body;
    
    // Validate payment type
    const validTypes = ["CREDIT_CARD", "PAYPAL", "BANK_TRANSFER", "CRYPTO"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid payment type" });
    }
    
    // Create new payment method
    const paymentMethod = await prisma.$transaction(async (prisma) => {
      // If isDefault is true, remove default flag from other payment methods
      if (isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false }
        });
      }
      
      // Create the new payment method
      return await prisma.paymentMethod.create({
        data: {
          userId,
          type,
          provider,
          accountNumber,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          isDefault: !!isDefault
        }
      });
    });
    
    return res.status(201).json({
      message: "Payment method added successfully",
      paymentMethod
    });
  } catch (error) {
    console.error("Error adding payment method:", error);
    return res.status(500).json({ message: "Error adding payment method", error: error.message });
  }
};

export const getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    
    if (paymentMethods.length === 0) {
      return res.status(404).json({ message: "No payment methods found" });
    }
    
    return res.json(paymentMethods);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return res.status(500).json({ message: "Error fetching payment methods", error: error.message });
  }
};

export const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    // Check if payment method exists and belongs to user
    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id }
    });
    
    if (!paymentMethod) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    
    if (paymentMethod.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this payment method" });
    }
    
    // Delete payment method
    await prisma.paymentMethod.delete({
      where: { id }
    });
    
    return res.json({ message: "Payment method deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return res.status(500).json({ message: "Error deleting payment method", error: error.message });
  }
};