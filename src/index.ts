import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "./config/passport";
import authRoutes from "./routes/authRoutes";
import auctionRoutes from "./routes/auctionRoutes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(passport.initialize());

app.get("/", (req, res) => {
  res.send("Welcome to the API");
});

app.use("/api/auth", authRoutes);
app.use("/api/auctions", auctionRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
