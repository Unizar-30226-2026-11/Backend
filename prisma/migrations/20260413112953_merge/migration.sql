-- CreateEnum
CREATE TYPE "Purchase_Type" AS ENUM ('SINGLE_CARD', 'CARD_PACK', 'COLLECTION', 'BOARD');

-- CreateEnum
CREATE TYPE "Board_Type" AS ENUM ('CLASSIC', 'NEON', 'STELLAR_GALAXY');

-- AlterTable
ALTER TABLE "Cards" ADD COLUMN     "url_image" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active_board_id" INTEGER;

-- CreateTable
CREATE TABLE "Board" (
    "id_board" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id_board")
);

-- CreateTable
CREATE TABLE "UserBoard" (
    "id_user_board" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_board" INTEGER NOT NULL,

    CONSTRAINT "UserBoard_pkey" PRIMARY KEY ("id_user_board")
);

-- CreateTable
CREATE TABLE "PurchaseHistory" (
    "id_purchase" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "purchase_type" "Purchase_Type" NOT NULL,
    "coins_spent" INTEGER NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "board_id" INTEGER,

    CONSTRAINT "PurchaseHistory_pkey" PRIMARY KEY ("id_purchase")
);

-- CreateTable
CREATE TABLE "PurchaseHistoryCard" (
    "id_purchase" INTEGER NOT NULL,
    "id_card" INTEGER NOT NULL,

    CONSTRAINT "PurchaseHistoryCard_pkey" PRIMARY KEY ("id_purchase","id_card")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_name_key" ON "Board"("name");

-- CreateIndex
CREATE INDEX "UserBoard_id_user_idx" ON "UserBoard"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "UserBoard_id_user_id_board_key" ON "UserBoard"("id_user", "id_board");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_active_board_id_fkey" FOREIGN KEY ("active_board_id") REFERENCES "Board"("id_board") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBoard" ADD CONSTRAINT "UserBoard_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBoard" ADD CONSTRAINT "UserBoard_id_board_fkey" FOREIGN KEY ("id_board") REFERENCES "Board"("id_board") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseHistory" ADD CONSTRAINT "PurchaseHistory_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "Board"("id_board") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseHistory" ADD CONSTRAINT "PurchaseHistory_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseHistoryCard" ADD CONSTRAINT "PurchaseHistoryCard_id_purchase_fkey" FOREIGN KEY ("id_purchase") REFERENCES "PurchaseHistory"("id_purchase") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseHistoryCard" ADD CONSTRAINT "PurchaseHistoryCard_id_card_fkey" FOREIGN KEY ("id_card") REFERENCES "Cards"("id_card") ON DELETE RESTRICT ON UPDATE CASCADE;
