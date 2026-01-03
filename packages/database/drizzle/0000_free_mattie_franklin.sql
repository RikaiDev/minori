CREATE TYPE "public"."locale" AS ENUM('zh-TW', 'en');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('farmer', 'cooperative_admin', 'cooperative_staff', 'customer');--> statement-breakpoint
CREATE TYPE "public"."planting_status" AS ENUM('active', 'harvested', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."quality_grade" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."growth_condition" AS ENUM('excellent', 'good', 'normal', 'poor', 'critical');--> statement-breakpoint
CREATE TYPE "public"."demand_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."demand_status" AS ENUM('pending', 'partially_matched', 'matched', 'fulfilled', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."quality_grade_demand" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."taiwan_region" AS ENUM('north', 'central', 'south', 'east');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('suggested', 'pending', 'accepted', 'rejected', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'read', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('harvest_reminder', 'harvest_confirmed', 'planting_confirmed', 'planting_optimal', 'weather_alert', 'weather_forecast', 'price_alert', 'price_opportunity', 'demand_new', 'demand_urgent', 'match_found', 'match_accepted', 'match_rejected', 'match_fulfilled', 'cooperative_announcement', 'system');--> statement-breakpoint
CREATE TABLE "cooperatives" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"region" varchar(20),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cooperatives_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"line_user_id" varchar(50) NOT NULL,
	"cooperative_id" text NOT NULL,
	"role" "user_role" DEFAULT 'farmer' NOT NULL,
	"name" varchar(100),
	"phone" varchar(20),
	"locale" "locale" DEFAULT 'zh-TW',
	"avatar_url" text,
	"is_active" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100),
	"area_size" real,
	"location_lat" real,
	"location_lng" real,
	"township" varchar(50),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planting_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"field_id" text,
	"crop_id" varchar(50) NOT NULL,
	"crop_name" varchar(100) NOT NULL,
	"area_size" real NOT NULL,
	"planted_at" timestamp with time zone NOT NULL,
	"expected_harvest_date" timestamp with time zone,
	"expected_yield" real,
	"prediction_confidence" real,
	"status" "planting_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvest_records" (
	"id" text PRIMARY KEY NOT NULL,
	"planting_record_id" text NOT NULL,
	"user_id" text NOT NULL,
	"crop_id" varchar(50) NOT NULL,
	"crop_name" varchar(100) NOT NULL,
	"quantity" real NOT NULL,
	"quality_grade" "quality_grade",
	"harvested_at" timestamp with time zone NOT NULL,
	"market_price" real,
	"cooperative_notified" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_records" (
	"id" text PRIMARY KEY NOT NULL,
	"planting_record_id" text NOT NULL,
	"condition" "growth_condition" NOT NULL,
	"notes" text,
	"images" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demands" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL,
	"buyer_name" varchar(100),
	"cooperative_id" text,
	"crop_id" varchar(50) NOT NULL,
	"crop_name" varchar(100) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"matched_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"min_quality_grade" "quality_grade_demand",
	"delivery_date_start" timestamp with time zone NOT NULL,
	"delivery_date_end" timestamp with time zone NOT NULL,
	"max_price_per_kg" numeric(10, 2),
	"preferred_region" "taiwan_region",
	"priority" "demand_priority" DEFAULT 'medium' NOT NULL,
	"status" "demand_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"demand_id" text NOT NULL,
	"planting_record_id" text NOT NULL,
	"farmer_id" text NOT NULL,
	"farmer_name" varchar(100),
	"cooperative_id" text NOT NULL,
	"crop_id" varchar(50) NOT NULL,
	"crop_name" varchar(100) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"expected_harvest_date" timestamp with time zone NOT NULL,
	"proposed_price_per_kg" numeric(10, 2),
	"expected_quality_grade" "quality_grade_demand",
	"score" jsonb NOT NULL,
	"status" "match_status" DEFAULT 'suggested' NOT NULL,
	"farmer_response" jsonb,
	"buyer_confirmation" jsonb,
	"farmer_notified" boolean DEFAULT false NOT NULL,
	"farmer_notified_at" timestamp with time zone,
	"buyer_notified" boolean DEFAULT false NOT NULL,
	"buyer_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooperative_sharing_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"sharing_cooperative_id" text NOT NULL,
	"receiving_cooperative_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sharing_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"cooperative_id" text NOT NULL,
	"share_supply_data" boolean DEFAULT false NOT NULL,
	"accept_external_demands" boolean DEFAULT false NOT NULL,
	"share_farmer_profiles" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sharing_configs_cooperative_id_unique" UNIQUE("cooperative_id")
);
--> statement-breakpoint
CREATE TABLE "member_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"cooperative_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"role" "user_role" DEFAULT 'farmer' NOT NULL,
	"code" varchar(10) NOT NULL,
	"invitee_email" varchar(255),
	"invitee_name" varchar(100),
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"timezone" varchar(50) DEFAULT 'Asia/Taipei' NOT NULL,
	"harvest_reminders" boolean DEFAULT true NOT NULL,
	"harvest_reminder_days" integer DEFAULT 3 NOT NULL,
	"weather_alerts" boolean DEFAULT true NOT NULL,
	"price_alerts" boolean DEFAULT true NOT NULL,
	"price_alert_threshold" integer DEFAULT 15 NOT NULL,
	"demand_notifications" boolean DEFAULT true NOT NULL,
	"match_notifications" boolean DEFAULT true NOT NULL,
	"cooperative_announcements" boolean DEFAULT true NOT NULL,
	"daily_digest" boolean DEFAULT false NOT NULL,
	"digest_time" varchar(5),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"cron_expression" varchar(50) NOT NULL,
	"type" "notification_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(20),
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cooperative_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"related_entity_id" text,
	"related_entity_type" varchar(50),
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"line_message_id" varchar(100),
	"error_message" text,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planting_records" ADD CONSTRAINT "planting_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planting_records" ADD CONSTRAINT "planting_records_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_planting_record_id_planting_records_id_fk" FOREIGN KEY ("planting_record_id") REFERENCES "public"."planting_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_records" ADD CONSTRAINT "growth_records_planting_record_id_planting_records_id_fk" FOREIGN KEY ("planting_record_id") REFERENCES "public"."planting_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demands" ADD CONSTRAINT "demands_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_planting_record_id_planting_records_id_fk" FOREIGN KEY ("planting_record_id") REFERENCES "public"."planting_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_farmer_id_users_id_fk" FOREIGN KEY ("farmer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooperative_sharing_relations" ADD CONSTRAINT "cooperative_sharing_relations_sharing_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("sharing_cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooperative_sharing_relations" ADD CONSTRAINT "cooperative_sharing_relations_receiving_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("receiving_cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sharing_configs" ADD CONSTRAINT "data_sharing_configs_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitations" ADD CONSTRAINT "member_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cooperatives_code_idx" ON "cooperatives" USING btree ("code");--> statement-breakpoint
CREATE INDEX "cooperatives_region_idx" ON "cooperatives" USING btree ("region");--> statement-breakpoint
CREATE INDEX "users_line_user_id_idx" ON "users" USING btree ("line_user_id");--> statement-breakpoint
CREATE INDEX "users_cooperative_id_idx" ON "users" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "fields_user_id_idx" ON "fields" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fields_township_idx" ON "fields" USING btree ("township");--> statement-breakpoint
CREATE INDEX "planting_records_user_id_idx" ON "planting_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "planting_records_field_id_idx" ON "planting_records" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "planting_records_crop_id_idx" ON "planting_records" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "planting_records_status_idx" ON "planting_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "planting_records_planted_at_idx" ON "planting_records" USING btree ("planted_at");--> statement-breakpoint
CREATE INDEX "planting_records_expected_harvest_idx" ON "planting_records" USING btree ("expected_harvest_date");--> statement-breakpoint
CREATE INDEX "planting_records_user_status_idx" ON "planting_records" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "harvest_records_planting_record_id_idx" ON "harvest_records" USING btree ("planting_record_id");--> statement-breakpoint
CREATE INDEX "harvest_records_user_id_idx" ON "harvest_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "harvest_records_crop_id_idx" ON "harvest_records" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "harvest_records_harvested_at_idx" ON "harvest_records" USING btree ("harvested_at");--> statement-breakpoint
CREATE INDEX "harvest_records_user_date_idx" ON "harvest_records" USING btree ("user_id","harvested_at");--> statement-breakpoint
CREATE INDEX "growth_records_planting_record_id_idx" ON "growth_records" USING btree ("planting_record_id");--> statement-breakpoint
CREATE INDEX "growth_records_recorded_at_idx" ON "growth_records" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "growth_records_condition_idx" ON "growth_records" USING btree ("condition");--> statement-breakpoint
CREATE INDEX "demands_buyer_id_idx" ON "demands" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "demands_cooperative_id_idx" ON "demands" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "demands_crop_id_idx" ON "demands" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "demands_status_idx" ON "demands" USING btree ("status");--> statement-breakpoint
CREATE INDEX "demands_priority_idx" ON "demands" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "demands_delivery_date_idx" ON "demands" USING btree ("delivery_date_start","delivery_date_end");--> statement-breakpoint
CREATE INDEX "demands_expires_at_idx" ON "demands" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "matches_demand_id_idx" ON "matches" USING btree ("demand_id");--> statement-breakpoint
CREATE INDEX "matches_planting_record_id_idx" ON "matches" USING btree ("planting_record_id");--> statement-breakpoint
CREATE INDEX "matches_farmer_id_idx" ON "matches" USING btree ("farmer_id");--> statement-breakpoint
CREATE INDEX "matches_cooperative_id_idx" ON "matches" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "matches_crop_id_idx" ON "matches" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "matches_expected_harvest_date_idx" ON "matches" USING btree ("expected_harvest_date");--> statement-breakpoint
CREATE INDEX "matches_farmer_notified_idx" ON "matches" USING btree ("farmer_notified");--> statement-breakpoint
CREATE INDEX "cooperative_sharing_relations_sharing_idx" ON "cooperative_sharing_relations" USING btree ("sharing_cooperative_id");--> statement-breakpoint
CREATE INDEX "cooperative_sharing_relations_receiving_idx" ON "cooperative_sharing_relations" USING btree ("receiving_cooperative_id");--> statement-breakpoint
CREATE INDEX "data_sharing_configs_cooperative_id_idx" ON "data_sharing_configs" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "member_invitations_cooperative_id_idx" ON "member_invitations" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "member_invitations_code_idx" ON "member_invitations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "member_invitations_status_idx" ON "member_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_schedules_type_idx" ON "notification_schedules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_schedules_is_active_idx" ON "notification_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "notification_schedules_next_run_at_idx" ON "notification_schedules" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_cooperative_id_idx" ON "notifications" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_scheduled_at_idx" ON "notifications" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");