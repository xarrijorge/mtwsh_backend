import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken } from "../config/jwt";
import { User, UserRole } from "../models/User";

let users: User[] = []; // Temporary in-memory storage

export const registerUser = async (
  req: Request<{},{},{ username: string; email: string; password: string; role: UserRole }>,
  res: Response
) => {
  try {
    const { username, email, password, role } = req.body;

    if (!["buyer", "seller", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified." });
    }

    const existingUser = users.find((user) => user.email === email);
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: String(users.length + 1),
      username,
      email,
      password: hashedPassword,
      role,
    };

    users.push(newUser);

    const token = generateToken(newUser.id, newUser.role); // 🔹 Fix: Now includes role
    return res.status(201).json({ user: { id: newUser.id, username, email, role }, token });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

export const loginUser = async (
  req: Request<{},{},{ email: string; password: string }>,
  res: Response
) => {
  try {
    const { email, password } = req.body;

    const user = users.find((user) => user.email === email);
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user.id, user.role); // 🔹 Fix: Now includes role
    return res.json({ user: { id: user.id, username: user.username, email, role: user.role }, token });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};
