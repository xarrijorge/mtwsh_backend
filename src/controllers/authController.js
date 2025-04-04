import { PrismaClient } from '@prisma/client';
import bcrypt from "bcryptjs";
import { generateToken } from "../config/jwt";

const prisma = new PrismaClient();

export const registerUser = async ( req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!["buyer", "seller", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
      }
    })
    const token = generateToken(newUser.id, newUser.role); // 🔹 Fix: Now includes role

    return res.status(201).json({ user: { id: newUser.id, username, email, role }, token });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

export const loginUser = async ( req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } }); 

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user.id, user.role); // 🔹 Fix: Now includes role
    return res.json({ user: { id: user.id, username: user.username, email, role: user.role }, token });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};