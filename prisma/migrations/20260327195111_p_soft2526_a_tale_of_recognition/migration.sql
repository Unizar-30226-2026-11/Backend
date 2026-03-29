-- CreateEnum
CREATE TYPE "User_States" AS ENUM ('DISCONNECTED', 'CONNECTED', 'UNKNOWN', 'IN_GAME');

-- CreateEnum
CREATE TYPE "Friendship_States" AS ENUM ('PENDING', 'FRIEND', 'BLOCKED');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'SPECIAL', 'EPIC', 'LEGENDARY');

-- CreateTable
CREATE TABLE "User" (
    "id_user" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "exp_level" INTEGER NOT NULL DEFAULT 0,
    "progress_level" INTEGER NOT NULL DEFAULT 0,
    "state" "User_States" NOT NULL DEFAULT 'UNKNOWN',
    "personal_state" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id_user_card" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_card" INTEGER NOT NULL,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id_user_card")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id_deck" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nuevo Mazo',
    "id_user" INTEGER NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id_deck")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id_deck" INTEGER NOT NULL,
    "id_user_card" INTEGER NOT NULL,

    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id_deck","id_user_card")
);

-- CreateTable
CREATE TABLE "Cards" (
    "id_card" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "id_collection" INTEGER NOT NULL,

    CONSTRAINT "Cards_pkey" PRIMARY KEY ("id_card")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id_collection" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id_collection")
);

-- CreateTable
CREATE TABLE "Friendships" (
    "id_user_1" INTEGER NOT NULL,
    "id_user_2" INTEGER NOT NULL,
    "state" "Friendship_States" NOT NULL,
    "beggining_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendships_pkey" PRIMARY KEY ("id_user_1","id_user_2")
);

-- CreateTable
CREATE TABLE "Games_log" (
    "id_game" SERIAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "beggining_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Games_log_pkey" PRIMARY KEY ("id_game")
);

-- CreateTable
CREATE TABLE "UserGameStats" (
    "points" INTEGER NOT NULL,
    "place" INTEGER NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_game" INTEGER NOT NULL,

    CONSTRAINT "UserGameStats_pkey" PRIMARY KEY ("id_user","id_game")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserCard_id_user_idx" ON "UserCard"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "Cards_title_key" ON "Cards"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_name_key" ON "Collection"("name");

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_id_card_fkey" FOREIGN KEY ("id_card") REFERENCES "Cards"("id_card") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_id_deck_fkey" FOREIGN KEY ("id_deck") REFERENCES "Deck"("id_deck") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_id_user_card_fkey" FOREIGN KEY ("id_user_card") REFERENCES "UserCard"("id_user_card") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cards" ADD CONSTRAINT "Cards_id_collection_fkey" FOREIGN KEY ("id_collection") REFERENCES "Collection"("id_collection") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendships" ADD CONSTRAINT "Friendships_id_user_1_fkey" FOREIGN KEY ("id_user_1") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendships" ADD CONSTRAINT "Friendships_id_user_2_fkey" FOREIGN KEY ("id_user_2") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameStats" ADD CONSTRAINT "UserGameStats_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "User"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameStats" ADD CONSTRAINT "UserGameStats_id_game_fkey" FOREIGN KEY ("id_game") REFERENCES "Games_log"("id_game") ON DELETE RESTRICT ON UPDATE CASCADE;
