-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_RESCHEDULED';

-- CreateTable
CREATE TABLE "FavoriteService" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteService_customerId_serviceId_key" ON "FavoriteService"("customerId", "serviceId");

-- AddForeignKey
ALTER TABLE "FavoriteService" ADD CONSTRAINT "FavoriteService_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteService" ADD CONSTRAINT "FavoriteService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
