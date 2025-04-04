import { PrismaClient } from '@prisma/client';
import bcrypt from "bcryptjs";
import { generateToken } from "../config/jwt";

const prisma = new PrismaClient();

export const registerUser = async (req, res) => {
  try {
    const { username, email, password, role, profileImage } = req.body;

    // Update role validation to match the new enum format
    if (!["BUYER", "SELLER", "ADMIN"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) return res.status(400).json({ message: "Username already taken" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        profileImage,
        lastLogin: new Date(),
      }
    });

    const token = generateToken(newUser.id, newUser.role);

    return res.status(201).json({ 
      user: { 
        id: newUser.id, 
        username, 
        email, 
        role,
        profileImage: newUser.profileImage,
        isVerified: newUser.isVerified
      }, 
      token 
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = generateToken(user.id, user.role);
    return res.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified
      }, 
      token 
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const verifyUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    await prisma.user.update({
      where: { id: userId },
      data: { isVerified: true }
    });
    
    return res.json({ message: "User verified successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error verifying user", error: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        profileImage: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true,
        addresses: true,
        // Include aggregates for reviews
        _count: {
          select: {
            auctions: true,
            bids: true,
            reviews: true,
            reviewsGiven: true
          }
        }
      }
    });
    
    if (!user) return res.status(404).json({ message: "User not found" });
    
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { username, profileImage } = req.body;
    
    // If updating username, check if it's already taken
    if (username) {
      const existingUsername = await prisma.user.findUnique({ 
        where: { username }
      });
      
      if (existingUsername && existingUsername.id !== userId) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        username,
        profileImage
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        profileImage: true,
        isVerified: true
      }
    });
    
    return res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    return res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};