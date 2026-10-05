#!/usr/bin/env python3
"""
Renewable Grid - Kafka Subscriber & PostgreSQL Ingestion
Consumes streaming records from 'renewable-energy-processed' (or input topic),
displays structured CMD logs, and persists valid records to PostgreSQL.
"""

import os
import sys
import json
import logging
import argparse
from kafka import KafkaConsumer

# Try importing psycopg2; handle gracefully if not yet installed
try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("SUBSCRIBER")

DEFAULT_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
DEFAULT_TOPIC = os.getenv("KAFKA_TOPIC", "renewable-energy-processed")
DEFAULT_GROUP = os.getenv("KAFKA_GROUP", "renewable-subscriber")

# PostgreSQL defaults
PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
PG_DB = os.getenv("POSTGRES_DB", "renewable_energy")
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

def init_db_connection():
    """Attempt connection to PostgreSQL database."""
    if not PSYCOPG2_AVAILABLE:
        logger.warning("[DATABASE] 'psycopg2' not installed. Running in console-only mode. (pip install psycopg2-binary)")
        return None

    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            database=PG_DB,
            user=PG_USER,
            password=PG_PASSWORD
        )
        conn.autocommit = True
        logger.info("[DATABASE] Connected successfully to PostgreSQL at %s:%d/%s", PG_HOST, PG_PORT, PG_DB)
        return conn
    except Exception as e:
        logger.warning("[DATABASE] Could not connect to PostgreSQL: %s. Streaming will continue without persistence.", e)
        return None

def insert_reading(conn, data):
    """
    Persist single energy reading to PostgreSQL using parameterized query (PRD Section 18).
    Never uses string formatting or concatenation for SQL values.
    """
    if conn is None:
        return False

    query = """
    INSERT INTO energy_readings 
    (
        timestamp,
        source,
        production,
        wind_production,
        solar_production,
        total_renewable,
        season,
        day_name,
        month_name
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                query,
                (
                    data.get("timestamp"),
                    data.get("source", "Unknown"),
                    data.get("production", 0.0),
                    data.get("wind_production", 0.0),
                    data.get("solar_production", 0.0),
                    data.get("total_renewable", data.get("production", 0.0)),
                    data.get("season", None),
                    data.get("day_name", None),
                    data.get("month_name", None)
                )
            )
        print(f"[DATABASE] Inserted record | timestamp={data.get('timestamp')}")
        return True
    except Exception as e:
        logger.error("[DATABASE] Error inserting record timestamp=%s: %s", data.get("timestamp"), e)
        return False

def main():
    parser = argparse.ArgumentParser(description="Renewable Grid Kafka Subscriber & Ingestor")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="Kafka broker host:port")
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help="Kafka topic to consume from")
    parser.add_argument("--group", default=DEFAULT_GROUP, help="Consumer group ID")
    parser.add_argument("--no-db", action="store_true", help="Disable PostgreSQL persistence")
    args = parser.parse_args()

    db_conn = None if args.no_db else init_db_connection()

    logger.info("Initializing subscriber on topic: '%s' | Group: '%s' | Broker: '%s'", args.topic, args.group, args.broker)

    try:
        consumer = KafkaConsumer(
            args.topic,
            bootstrap_servers=args.broker,
            group_id=args.group,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda v: json.loads(v.decode("utf-8"))
        )
    except Exception as e:
        logger.error("Failed to initialize Kafka consumer: %s", e)
        sys.exit(1)

    logger.info("Subscriber listening for incoming records...")

    try:
        for message in consumer:
            data = message.value

            timestamp = data.get("timestamp", "N/A")
            source = data.get("source", "N/A")
            wind = data.get("wind_production", 0.0)
            solar = data.get("solar_production", 0.0)
            total = data.get("total_renewable", data.get("production", 0.0))

            # CMD logging matching PRD Section 10 standard
            print(
                f"[SUBSCRIBER] "
                f"{timestamp} | "
                f"Source={source} | "
                f"Wind={wind} MW | "
                f"Solar={solar} MW | "
                f"Total={total} MW | "
                f"Partition={message.partition} | "
                f"Offset={message.offset}"
            )

            # Persist to PostgreSQL if connected
            if db_conn is not None:
                insert_reading(db_conn, data)

    except KeyboardInterrupt:
        logger.info("Subscriber interrupted by user (KeyboardInterrupt).")

    finally:
        logger.info("Closing Kafka consumer and database connections...")
        consumer.close()
        if db_conn:
            try:
                db_conn.close()
            except Exception:
                pass
        logger.info("Subscriber stopped cleanly.")

if __name__ == "__main__":
    main()
