CREATE TYPE "public"."admin_role" AS ENUM('dona', 'admin');--> statement-breakpoint
ALTER TABLE "admin_user" ADD COLUMN "role" "admin_role" DEFAULT 'admin' NOT NULL;