#!/usr/bin/env python3
"""
Renewable Grid - Kafka Producer
Reads historical renewable energy records sequentially from CSV,
validates each record against system guardrails, converts to JSON,
and streams events into Kafka topic 'renewable-energy'.
"""

import os
import sys
import time
import json
import math
import logging
import argparse
import pandas as pd
from kafka import KafkaProducer
from kafka.errors import KafkaError

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("PRODUCER")

DEFAULT_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
DEFAULT_TOPIC = os.getenv("KAFKA_TOPIC", "renewable-energy")
DEFAULT_INTERVAL = float(os.getenv("STREAM_INTERVAL", "1.0"))

def find_dataset_path(provided_path=None):
    """Resolve the dataset file path robustly."""
    if provided_path and os.path.exists(provided_path):
        return os.path.abspath(provided_path)

    # Search common locations relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(script_dir, "..", "data", "renewable_energy.csv"),
        os.path.join(script_dir, "..", "Energy Production Dataset.csv"),
        os.path.join(script_dir, "data", "renewable_energy.csv"),
        os.path.join(os.getcwd(), "data", "renewable_energy.csv"),
        os.path.join(os.getcwd(), "renewable-grid", "data", "renewable_energy.csv"),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return os.path.abspath(candidate)
    
    raise FileNotFoundError(f"Could not locate renewable energy dataset in expected locations: {candidates}")

def validate_record(record):
    """
    Validate record against data guardrails (PRD Section 17.1):
    - Validate numeric fields before publishing
    - Reject or quarantine malformed records
    - Reject NaN, infinite values, or negative production
    - Do not silently replace missing values with zero
    """
    # Check required fields
    required_keys = ["timestamp", "production"]
    for key in required_keys:
        if key not in record or record[key] is None:
            return False, f"Missing required field: '{key}'"

    # Validate production value
    val = record["production"]
    if not isinstance(val, (int, float)):
        return False, f"Production value '{val}' is not numeric"
    if math.isnan(val) or math.isinf(val):
        return False, f"Invalid numerical production value (NaN or Inf)"
    if val < 0:
        return False, f"Negative production value: {val}"

    # Validate wind and solar production
    for f in ["wind_production", "solar_production"]:
        if f in record and record[f] is not None:
            v = record[f]
            if not isinstance(v, (int, float)) or math.isnan(v) or math.isinf(v) or v < 0:
                return False, f"Invalid value for {f}: {v}"

    return True, "Valid"

def row_to_event(row):
    """Convert dataset row into standard JSON-serializable event payload."""
    # Check schema variation: dataset may have Date + Start_Hour or direct timestamp
    if "Date" in row and "Start_Hour" in row:
        date_str = str(row["Date"]).strip()
        start_hour = int(row["Start_Hour"])
        # Format standardized timestamp YYYY-MM-DD HH:MM:SS
        try:
            parsed_dt = pd.to_datetime(date_str) + pd.to_timedelta(start_hour, unit="h")
            timestamp = parsed_dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            timestamp = f"{date_str} {start_hour:02d}:00:00"

        source = str(row.get("Source", "Unknown")).strip()
        production = float(row.get("Production", 0.0))

        # Map to wind/solar components based on Source column
        if source.lower() == "wind":
            wind_prod = production
            solar_prod = 0.0
        elif source.lower() == "solar":
            wind_prod = 0.0
            solar_prod = production
        else:
            wind_prod = production
            solar_prod = 0.0

        event = {
            "timestamp": timestamp,
            "date": date_str,
            "start_hour": start_hour,
            "end_hour": int(row.get("End_Hour", (start_hour + 1) % 24)),
            "source": source,
            "production": production,
            "wind_production": wind_prod,
            "solar_production": solar_prod,
            "day_of_year": int(row.get("Day_of_Year", 0)) if pd.notnull(row.get("Day_of_Year")) else None,
            "day_name": str(row.get("Day_Name", "")) if pd.notnull(row.get("Day_Name")) else "",
            "month_name": str(row.get("Month_Name", "")) if pd.notnull(row.get("Month_Name")) else "",
            "season": str(row.get("Season", "")) if pd.notnull(row.get("Season")) else ""
        }
    else:
        # Standard fallback if direct timestamp column exists
        timestamp = str(row.get("timestamp", ""))
        wind_prod = float(row.get("wind_production", 0.0))
        solar_prod = float(row.get("solar_production", 0.0))
        production = wind_prod + solar_prod
        source = "Wind/Solar"

        event = {
            "timestamp": timestamp,
            "source": source,
            "production": production,
            "wind_production": wind_prod,
            "solar_production": solar_prod
        }

    return event

def create_kafka_producer(broker, retries=5, retry_delay=3):
    """Instantiate KafkaProducer with retry logic."""
    for attempt in range(1, retries + 1):
        try:
            logger.info("Connecting to Kafka broker at %s (attempt %d/%d)...", broker, attempt, retries)
            producer = KafkaProducer(
                bootstrap_servers=broker,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                acks="all",
                retries=3,
                max_block_ms=10000
            )
            logger.info("Connected successfully to Kafka broker.")
            return producer
        except Exception as e:
            logger.warning("Failed to connect to Kafka at %s: %s", broker, e)
            if attempt < retries:
                time.sleep(retry_delay)
            else:
                logger.error("Could not establish connection to Kafka after %d attempts.", retries)
                raise

def main():
    parser = argparse.ArgumentParser(description="Renewable Grid Kafka Producer")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="Kafka broker host:port")
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help="Kafka topic to publish to")
    parser.add_argument("--interval", type=float, default=DEFAULT_INTERVAL, help="Delay between records in seconds")
    parser.add_argument("--file", default=None, help="Path to renewable energy CSV dataset")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of records to stream (for testing)")
    args = parser.parse_args()

    dataset_path = find_dataset_path(args.file)
    logger.info("Loading dataset from: %s", dataset_path)
    df = pd.read_csv(dataset_path)
    total_records = len(df)
    logger.info("Loaded %d rows from dataset.", total_records)

    producer = create_kafka_producer(args.broker)

    logger.info("Producer streaming to topic: '%s' | Interval: %.2fs", args.topic, args.interval)

    sent_count = 0
    rejected_count = 0

    try:
        for idx, row in df.iterrows():
            if args.limit and sent_count >= args.limit:
                logger.info("Reached stream limit of %d records. Stopping.", args.limit)
                break

            record = row_to_event(row)
            is_valid, reason = validate_record(record)

            if not is_valid:
                rejected_count += 1
                logger.warning("[GUARDRAIL] Rejected record index=%d: %s | Data: %s", idx, reason, record)
                continue

            try:
                future = producer.send(args.topic, value=record)
                metadata = future.get(timeout=10)

                sent_count += 1
                # Structured log matching PRD standards
                print(
                    f"[PRODUCER] Sent record | "
                    f"timestamp={record['timestamp']} | "
                    f"source={record.get('source')} | "
                    f"production={record.get('production')} MW | "
                    f"topic={metadata.topic} | "
                    f"partition={metadata.partition} | "
                    f"offset={metadata.offset}"
                )

            except KafkaError as ke:
                logger.error("[PRODUCER] Kafka send error at index %d: %s", idx, ke)

            time.sleep(args.interval)

    except KeyboardInterrupt:
        logger.info("Streaming interrupted by user (KeyboardInterrupt).")

    finally:
        logger.info("Flushing and closing Kafka producer...")
        producer.flush()
        producer.close()
        logger.info("Producer shutdown complete. (Sent: %d, Rejected: %d)", sent_count, rejected_count)

if __name__ == "__main__":
    main()
