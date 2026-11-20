CREATE TYPE "order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('open', 'partially_filled', 'filled', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "order_type" AS ENUM('limit', 'market');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"symbol" varchar(16) NOT NULL UNIQUE,
	"name" varchar(32) NOT NULL,
	"decimals" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decimals_non_negative" CHECK ("decimals" >= 0)
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"user_id" integer,
	"asset_id" integer,
	"available" bigint DEFAULT 0 NOT NULL,
	"locked" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balances_pkey" PRIMARY KEY("user_id","asset_id"),
	CONSTRAINT "available_non_negative" CHECK ("available" >= 0),
	CONSTRAINT "locked_non_negative" CHECK ("locked" >= 0)
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "markets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"symbol" varchar(32) NOT NULL UNIQUE,
	"base_asset_id" integer NOT NULL,
	"quote_asset_id" integer NOT NULL,
	"tick_size" bigint NOT NULL,
	"step_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"min_order_size" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "markets_base_asset_id_quote_asset_id_unique" UNIQUE("base_asset_id","quote_asset_id"),
	CONSTRAINT "base_not_quote" CHECK ("base_asset_id" <> "quote_asset_id"),
	CONSTRAINT "min_size_positive" CHECK ("min_order_size" > 0),
	CONSTRAINT "tick_positive" CHECK ("tick_size" > 0),
	CONSTRAINT "step_positive" CHECK ("step_size" > 0),
	CONSTRAINT "min_size_on_step" CHECK ("min_order_size" % "step_size" = 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"market_id" integer NOT NULL,
	"side" "order_side" NOT NULL,
	"type" "order_type" NOT NULL,
	"price" bigint,
	"qty" bigint NOT NULL,
	"filled_qty" bigint DEFAULT 0 NOT NULL,
	"locked_amount" bigint NOT NULL,
	"status" "order_status" DEFAULT 'open'::"order_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qty_positive" CHECK ("qty" > 0),
	CONSTRAINT "filled_range" CHECK ("filled_qty" >= 0 AND "filled_qty" <= "qty"),
	CONSTRAINT "price_positive" CHECK ("price" IS NULL OR "price" > 0),
	CONSTRAINT "price_matches_type" CHECK (("type" = 'limit' AND "price" IS NOT NULL) OR ("type" = 'market' AND "price" IS NULL)),
	CONSTRAINT "check_if_filled_mark_as_qty" CHECK ("status" <> 'filled' OR "filled_qty" = "qty"),
	CONSTRAINT "locked_amount_non_negative" CHECK ("locked_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "trades_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"market_id" integer NOT NULL,
	"price" bigint,
	"qty" bigint NOT NULL,
	"buy_order_id" bigint NOT NULL,
	"sell_order_id" bigint NOT NULL,
	"taker_side" "order_side" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trades_pkey" PRIMARY KEY("id","created_at"),
	CONSTRAINT "trade_price_positive" CHECK ("price" > 0),
	CONSTRAINT "trade_qty_positive" CHECK ("qty" > 0),
	CONSTRAINT "buy_n_sell_should_not_eq" CHECK ("buy_order_id" <> "sell_order_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"pass_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_lower_case" CHECK ("email" = lower("email"))
);
--> statement-breakpoint
CREATE INDEX "orders_market_status_idx" ON "orders" ("market_id","status");--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "trades_market_time__idx" ON "trades" ("market_id","created_at");--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_base_asset_id_assets_id_fkey" FOREIGN KEY ("base_asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_quote_asset_id_assets_id_fkey" FOREIGN KEY ("quote_asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_markets_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buy_order_id_orders_id_fkey" FOREIGN KEY ("buy_order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_sell_order_id_orders_id_fkey" FOREIGN KEY ("sell_order_id") REFERENCES "orders"("id");