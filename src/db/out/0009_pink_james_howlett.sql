ALTER TABLE "chats" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "messageParts" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" DROP IDENTITY;