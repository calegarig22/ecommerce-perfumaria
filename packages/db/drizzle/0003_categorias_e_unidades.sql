ALTER TABLE "fragrances" ALTER COLUMN "family" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "fragrances" ALTER COLUMN "gender" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "product_lines" ADD COLUMN "unit" text DEFAULT 'ml' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_lines" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "unit" text DEFAULT 'ml' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "product_lines" ADD CONSTRAINT "product_lines_unit" CHECK ("product_lines"."unit" IN ('ml', 'g', 'un'));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variants_unit" CHECK ("product_variants"."unit" IN ('ml', 'g', 'un'));