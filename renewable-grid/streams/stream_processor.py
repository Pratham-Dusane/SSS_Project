#!/usr/bin/env python3
"""
Renewable Grid - Real-Time Stream Processor
Consumes from raw topic 'renewable-energy', validates records,
computes real-time transformations and aggregations:
- total_renewable = wind_production + solar_production
- wind_percentage
- solar_percentage
And publishes processed events to 'renewable-energy-processed'.
"""

import os
import sys
import json
import logging
import argparse
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("STREAM")

DEFAULT_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "renewable-energy")
OUTPUT_TOPIC = os.getenv("KAFKA_OUTPUT_TOPIC", "renewable-energy-processed")
GROUP_ID = os.getenv("KAFKA_STREAM_GROUP", "renewable-stream-processor")

def transform_record(record):
    """
    Validate and enrich incoming streaming record.
    Calculates total_renewable, wind_percentage, solar_percentage.
    """
    if record is None or not isinstance(record, dict):
        return None, "Null or malformed record"

    timestamp = record.get("timestamp")
    if not timestamp:
        return None, "Record missing timestamp"

    try:
        wind = float(record.get("wind_production", 0.0))
        solar = float(record.get("solar_production", 0.0))
        production = float(record.get("production", wind + solar))
    except (ValueError, TypeError) as e:
        return None, f"Non-numeric values in energy readings: {e}"

    # Calculate total renewable energy
    total_renewable = wind + solar if (wind > 0 or solar > 0) else production

    # Calculate generation share percentages
    if total_renewable > 0:
        wind_pct = round((wind / total_renewable) * 100, 2)
        solar_pct = round((solar / total_renewable) * 100, 2)
    else:
        wind_pct = 0.0
        solar_pct = 0.0

    # Build processed event
    processed = dict(record)
    processed["total_renewable"] = round(total_renewable, 2)
    processed["wind_percentage"] = wind_pct
    processed["solar_percentage"] = solar_pct
    processed["processed_by"] = "stream-processor"

    return processed, "OK"

def main():
    parser = argparse.ArgumentParser(description="Renewable Grid Stream Processor")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="Kafka broker host:port")
    parser.add_argument("--input-topic", default=INPUT_TOPIC, help="Input raw topic")
    parser.add_argument("--output-topic", default=OUTPUT_TOPIC, help="Output processed topic")
    parser.add_argument("--group", default=GROUP_ID, help="Consumer group ID")
    args = parser.parse_args()

    logger.info("Initializing Stream Processor...")
    logger.info("Connecting to broker: %s", args.broker)
    logger.info("Input topic: '%s' -> Output topic: '%s'", args.input_topic, args.output_topic)

    try:
        consumer = KafkaConsumer(
            args.input_topic,
            bootstrap_servers=args.broker,
            group_id=args.group,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda v: json.loads(v.decode("utf-8"))
        )

        producer = KafkaProducer(
            bootstrap_servers=args.broker,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all"
        )
    except Exception as e:
        logger.error("Failed to connect stream processor to Kafka: %s", e)
        sys.exit(1)

    logger.info("Stream processor active and listening for records...")

    try:
        for message in consumer:
            raw_record = message.value
            processed_record, status = transform_record(raw_record)

            if processed_record is None:
                logger.warning("[STREAM] Dropped malformed record: %s | Payload: %s", status, raw_record)
                continue

            # Forward to processed topic
            future = producer.send(args.output_topic, value=processed_record)
            meta = future.get(timeout=10)

            # Structured logging matching PRD Section 20
            print(
                f"[STREAM] Processed record | "
                f"timestamp={processed_record['timestamp']} | "
                f"total_generation={processed_record['total_renewable']} MW "
                f"(Wind: {processed_record['wind_percentage']}%, Solar: {processed_record['solar_percentage']}%) | "
                f"output_partition={meta.partition} | offset={meta.offset}"
            )

    except KeyboardInterrupt:
        logger.info("Stream processor stopping (KeyboardInterrupt)...")

    finally:
        consumer.close()
        producer.flush()
        producer.close()
        logger.info("Stream processor stopped cleanly.")

if __name__ == "__main__":
    main()
