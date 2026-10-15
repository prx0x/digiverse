CREATE TYPE "public"."clash_penalty_mode" AS ENUM('FIXED_X', 'TWO_THIRDS_OF_PICK');--> statement-breakpoint
CREATE TYPE "public"."degenerate_round_mode" AS ENUM('NO_TARGET', 'CLASH_PENALTIES_ONLY');--> statement-breakpoint
CREATE TYPE "public"."display_rounding" AS ENUM('HALF_UP', 'TRUNCATE');--> statement-breakpoint
CREATE TYPE "public"."equality_mode" AS ENUM('EXACT', 'ROUND_TARGET_TO_INTEGER', 'EPSILON');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'READY', 'LIVE', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."game_phase" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."majority_penalty_mode" AS ENUM('FIXED_X', 'HALF_ABS_DISTANCE', 'HALF_SIGNED_DISTANCE');--> statement-breakpoint
CREATE TYPE "public"."matching_mode" AS ENUM('EXACT', 'NORMALIZED', 'NUMERIC');--> statement-breakpoint
CREATE TYPE "public"."no_pick_behaviour" AS ENUM('SCORE_ZERO', 'EXCLUDE', 'AUTO_RANDOM');--> statement-breakpoint
CREATE TYPE "public"."power_up_card" AS ENUM('SHIELD', 'RESERVE', 'PEEK', 'REVERSE');--> statement-breakpoint
CREATE TYPE "public"."rapid_fire_tie_break" AS ENUM('EARLIEST_RECEIVED_THEN_ID', 'SHARE');--> statement-breakpoint
CREATE TYPE "public"."reversed_majority_reward" AS ENUM('PICK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."sample_stddev_single" AS ENUM('ZERO', 'NO_TARGET');--> statement-breakpoint
CREATE TYPE "public"."stat_card" AS ENUM('MEAN', 'TWO_THIRDS', 'MIDRANGE', 'MEAN_PLUS_SIGMA', 'GEOMETRIC_MEAN');--> statement-breakpoint
CREATE TYPE "public"."std_dev_mode" AS ENUM('POPULATION', 'SAMPLE');--> statement-breakpoint
CREATE TABLE "card_supply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"card_type" "power_up_card" NOT NULL,
	"max_supply" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_supply_event_card_unique" UNIQUE("event_id","card_type")
);
--> statement-breakpoint
CREATE TABLE "event_rules" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"clash_penalty_mode" "clash_penalty_mode",
	"clash_penalty_x" numeric(20, 10),
	"majority_penalty_mode" "majority_penalty_mode",
	"majority_penalty_x" numeric(20, 10),
	"reversed_majority_reward" "reversed_majority_reward",
	"reverse_affects_equal_to" boolean,
	"reverse_affects_tiebreaker" boolean,
	"reverse_is_global" boolean,
	"shield_covers_clash" boolean,
	"shield_covers_majority" boolean,
	"shield_covers_reversed_minority" boolean,
	"shield_consumed_on_play" boolean,
	"std_dev_mode" "std_dev_mode",
	"sample_stddev_for_single_value" "sample_stddev_single",
	"degenerate_round_mode" "degenerate_round_mode",
	"equality_mode" "equality_mode",
	"equality_epsilon" numeric(20, 10),
	"display_rounding" "display_rounding",
	"max_cards_played_per_round_per_team" integer,
	"allow_multiple_reverse_per_team" boolean,
	"unused_cards_carry_forward" boolean,
	"cards_consumed_even_if_no_effect" boolean,
	"no_pick_behaviour" "no_pick_behaviour",
	"allow_pick_change_before_lock" boolean,
	"pre_round_cards_lobby_only" boolean,
	"rapid_fire_tie_break" "rapid_fire_tie_break",
	"rapid_fire_max_attempts" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) DEFAULT 'Digiverse' NOT NULL,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"game_phase_a_round_count" integer DEFAULT 1 NOT NULL,
	"game_phase_b_round_count" integer DEFAULT 1 NOT NULL,
	"rapid_fire_default_time_limit_seconds" integer DEFAULT 30 NOT NULL,
	"round_selection_seconds" integer DEFAULT 60 NOT NULL,
	"stat_card_announcement_seconds" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"answer_definition" text NOT NULL,
	"matching_mode" "matching_mode" DEFAULT 'NORMALIZED' NOT NULL,
	"time_limit_seconds" integer NOT NULL,
	"mapped_card" "power_up_card",
	"top_n" integer DEFAULT 1 NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"game_phase" "game_phase" NOT NULL,
	"round_number" integer NOT NULL,
	"stat_card" "stat_card",
	"timer_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_configs_event_phase_number_unique" UNIQUE("event_id","game_phase","round_number")
);
--> statement-breakpoint
ALTER TABLE "card_supply" ADD CONSTRAINT "card_supply_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rules" ADD CONSTRAINT "event_rules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_set_id_question_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."question_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_configs" ADD CONSTRAINT "round_configs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;