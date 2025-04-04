import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();


const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const JWT_EXPIRY = "7d";

export const generateToken = (userId, role ) => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

export const verifyToken = (token ) => {
  return jwt.verify(token, JWT_SECRET);
};
