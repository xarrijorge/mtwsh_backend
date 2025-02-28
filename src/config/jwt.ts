import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { UserRole } from "../models/User";

dotenv.config();


const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const JWT_EXPIRY = "7d";

export const generateToken = (userId: string, role: UserRole) => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
