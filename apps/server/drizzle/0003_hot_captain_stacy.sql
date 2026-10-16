CREATE TYPE "public"."round_status" AS ENUM('LOBBY', 'SELECTION', 'CLASH_RESOLUTION', 'CALCULATION', 'BUCKETING', 'SCORING', 'RESULT', 'ABORTED');--> statement-breakpoint
CREATE TYPE "public"."score_ledger_component" AS ENUM('STARTING_POINTS', 'CLASH_PENALTY', 'MAJORITY_DEDUCTION', 'REVERSED_MINORITY_DEDUCTION', 'REVERSED_MAJORITY_AWARD', 'MINORITY_AWARD', 'EXACT_MATCH_AWARD', 'TIE_ZERO', 'NO_PICK_PENALTY', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"stat_card" "stat_card" NOT NULL,
	"status" "round_status" DEFAULT 'LOBBY' NOT NULL,
	"lobby_seconds" integer DEFAULT 15 NOT NULL,
	"selection_seconds" integer DEFAULT 60 NOT NULL,
	"lobby_started_at" timestamp with time zone,
	"selection_started_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"target_value" numeric(20, 10),
	"display_target" varchar(32),
	"is_degenerate" boolean DEFAULT false NOT NULL,
	"is_practice" boolean DEFAULT false NOT NULL,
	"score_multiplier" integer DEFAULT 1 NOT NULL,
	"reverse_count" integer DEFAULT 0 NOT NULL,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_rounds_event_number_unique" UNIQUE("event_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "round_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"round_id" uuid,
	"action" varchar(64) NOT NULL,
	"admin_user_id" uuid,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_card_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"card_type" "power_up_card" NOT NULL,
	"phase" varchar(16) NOT NULL,
	"metadata" text,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_card_plays_round_team_unique" UNIQUE("round_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "round_palettes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"palette_numbers" text NOT NULL,
	"seed" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_palettes_round_team_unique" UNIQUE("round_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "round_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"pick" integer NOT NULL,
	"is_locked" boolean DEFAULT true NOT NULL,
	"is_reserve_pick" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_picks_round_team_unique" UNIQUE("round_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "score_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"round_id" uuid,
	"team_id" uuid NOT NULL,
	"component" "score_ledger_component" NOT NULL,
	"points_delta" numeric(20, 10) NOT NULL,
	"balance_after" numeric(20, 10) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_audit_logs" ADD CONSTRAINT "round_audit_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_audit_logs" ADD CONSTRAINT "round_audit_logs_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_audit_logs" ADD CONSTRAINT "round_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_card_plays" ADD CONSTRAINT "round_card_plays_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_card_plays" ADD CONSTRAINT "round_card_plays_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_palettes" ADD CONSTRAINT "round_palettes_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_palettes" ADD CONSTRAINT "round_palettes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_picks" ADD CONSTRAINT "round_picks_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_picks" ADD CONSTRAINT "round_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;