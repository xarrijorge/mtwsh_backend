/*
  Warnings:

  - Changed the type of `status` on the `Auction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('KES', 'USD', 'EUR', 'GBP');

-- AlterEnum
ALTER TYPE "AuctionStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL;
