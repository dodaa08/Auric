CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT create_hypertable('trades', 'created_at');