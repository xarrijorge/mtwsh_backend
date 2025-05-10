/*
  Warnings:

  - The `status` column on the `Auction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "status",
ADD COLUMN     "status" "AuctionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "defaultCurrency" "Currency" NOT NULL DEFAULT 'KES';
