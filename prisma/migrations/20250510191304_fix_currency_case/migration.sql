/*
  Warnings:

  - You are about to drop the column `Currency` on the `Auction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Auction" DROP COLUMN "Currency",
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'KES';
