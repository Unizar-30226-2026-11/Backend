-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "url_image" TEXT;

-- AlterTable
ALTER TABLE "Cards" ALTER COLUMN "url_image" DROP DEFAULT;
