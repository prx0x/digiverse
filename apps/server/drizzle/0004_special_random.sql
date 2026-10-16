CREATE TYPE "public"."question_type" AS ENUM('TEXT', 'MCQ');--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "question_type" "question_type" DEFAULT 'TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "options" jsonb;