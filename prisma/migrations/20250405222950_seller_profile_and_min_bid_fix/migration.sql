-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'STORE');

-- AlterTable
ALTER TABLE "Auction" ALTER COLUMN "minBidIncrement" DROP NOT NULL,
ALTER COLUMN "minBidIncrement" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SellerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SellerType" NOT NULL,
    "storeName" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "contactPhone" TEXT,
    "rating" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "SellerProfile"("userId");

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
