CREATE TYPE "public"."rapid_fire_status" AS ENUM('IDLE', 'QUESTION_OPEN', 'CLOSED', 'AWARDED');--> statement-breakpoint
CREATE TABLE "rapid_fire_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"card_type" "power_up_card" NOT NULL,
	"rank" integer NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rapid_fire_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"status" "rapid_fire_status" DEFAULT 'IDLE' NOT NULL,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"awarded_at" timestamp with time zone,
	"time_limit_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rapid_fire_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"raw_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rf_submissions_session_team_attempt_unique" UNIQUE("session_id","team_id","attempt_number")
);
--> statement-breakpoint
CREATE TABLE "team_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"card_type" "power_up_card" NOT NULL,
	"acquired_from" varchar(32) DEFAULT 'RAPID_FIRE' NOT NULL,
	"question_id" uuid,
	"used_in_round_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rapid_fire_awards" ADD CONSTRAINT "rapid_fire_awards_session_id_rapid_fire_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rapid_fire_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapid_fire_awards" ADD CONSTRAINT "rapid_fire_awards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapid_fire_sessions" ADD CONSTRAINT "rapid_fire_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapid_fire_sessions" ADD CONSTRAINT "rapid_fire_sessions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapid_fire_submissions" ADD CONSTRAINT "rapid_fire_submissions_session_id_rapid_fire_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rapid_fire_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapid_fire_submissions" ADD CONSTRAINT "rapid_fire_submissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_cards" ADD CONSTRAINT "team_cards_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_cards" ADD CONSTRAINT "team_cards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_cards" ADD CONSTRAINT "team_cards_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;