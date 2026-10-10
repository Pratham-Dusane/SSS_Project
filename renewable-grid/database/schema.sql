-- Renewable Energy Streaming, Forecasting & Grid Balancing System
-- PostgreSQL Database Schema
-- Target Database: renewable_energy

-- Core table for persisting streaming energy readings
CREATE TABLE IF NOT EXISTS energy_readings (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    source VARCHAR(50) DEFAULT 'Unknown',
    production DOUBLE PRECISION,
    wind_production DOUBLE PRECISION DEFAULT 0.0,
    solar_production DOUBLE PRECISION DEFAULT 0.0,
    total_renewable DOUBLE PRECISION DEFAULT 0.0,
    season VARCHAR(50),
    day_name VARCHAR(20),
    month_name VARCHAR(20),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient time-series queries and ML feature extraction
CREATE INDEX IF NOT EXISTS idx_energy_readings_timestamp ON energy_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_energy_readings_source ON energy_readings(source);
CREATE INDEX IF NOT EXISTS idx_energy_readings_received_at ON energy_readings(received_at);

-- Analytical view: Hourly generation summary
CREATE OR REPLACE VIEW hourly_generation_summary AS
SELECT 
    DATE_TRUNC('hour', timestamp) AS reading_hour,
    COUNT(*) AS record_count,
    ROUND(AVG(wind_production)::numeric, 2) AS avg_wind_mw,
    ROUND(AVG(solar_production)::numeric, 2) AS avg_solar_mw,
    ROUND(AVG(total_renewable)::numeric, 2) AS avg_total_renewable_mw,
    ROUND(MAX(total_renewable)::numeric, 2) AS peak_renewable_mw
FROM energy_readings
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY reading_hour DESC;

-- Analytical view: Daily generation summary
CREATE OR REPLACE VIEW daily_generation_summary AS
SELECT 
    DATE(timestamp) AS reading_date,
    COUNT(*) AS record_count,
    ROUND(AVG(wind_production)::numeric, 2) AS avg_wind_mw,
    ROUND(AVG(solar_production)::numeric, 2) AS avg_solar_mw,
    ROUND(AVG(total_renewable)::numeric, 2) AS avg_total_renewable_mw,
    ROUND(MAX(total_renewable)::numeric, 2) AS peak_renewable_mw
FROM energy_readings
GROUP BY DATE(timestamp)
ORDER BY reading_date DESC;
