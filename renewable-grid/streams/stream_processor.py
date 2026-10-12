#!/usr/bin/env python3
"""
Renewable Grid - Real-Time Stream Processor with Online ML Forecasting
=======================================================================
Consumes from raw topic 'renewable-energy', validates incoming records,
computes streaming transformations (total_renewable, wind/solar share),
executes the champion LightGBM forecasting model (predicting t+1 hour),
evaluates the Phase 7 Grid Balancing decision rule, and publishes the
enriched telemetry record to 'renewable-energy-processed'.
"""

import os
import sys
import json
import logging
import argparse
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError

# Add parent path to import dataproc.predictor
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PARENT_DIR)

try:
    from dataproc.predictor import OnlineEnergyForecaster
    ML_AVAILABLE = True
except Exception as e:
    ML_AVAILABLE = False
    ML_IMPORT_ERR = str(e)

# Configure structured logging matching PRD Section 20
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("STREAM-PROCESSOR")

DEFAULT_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "renewable-energy")
OUTPUT_TOPIC = os.getenv("KAFKA_OUTPUT_TOPIC", "renewable-energy-processed")
GROUP_ID = os.getenv("KAFKA_STREAM_GROUP", "renewable-stream-processor")
DEFAULT_DEMAND = float(os.getenv("GRID_DEMAND_MW", "7500.0"))
DEFAULT_THRESHOLD = float(os.getenv("GRID_THRESHOLD_MW", "300.0"))

def transform_and_forecast(record, forecaster=None, demand=DEFAULT_DEMAND, threshold=DEFAULT_THRESHOLD):
    """
    Validate, enrich with streaming calculations, and run ML forecast + grid balancing.
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
        wind_pct = round((wind / total_renewable) * 100, 1)
        solar_pct = round((solar / total_renewable) * 100, 1)
    else:
        wind_pct = 0.0
        solar_pct = 0.0

    # Build processed event base
    processed = dict(record)
    processed["wind_production"] = round(wind, 1)
    processed["solar_production"] = round(solar, 1)
    processed["total_renewable"] = round(total_renewable, 1)
    processed["production"] = round(total_renewable, 1)
    processed["wind_percentage"] = wind_pct
    processed["solar_percentage"] = solar_pct
    processed["processed_by"] = "stream-processor-ml"

    # ML Forecasting & Grid Balancing Layer
    if forecaster is not None:
        try:
            forecast_results = forecaster.predict_stream(
                current_prod=total_renewable,
                timestamp_str=timestamp,
                demand=demand,
                threshold=threshold
            )
            processed["forecast_t1_mw"] = forecast_results["forecast_t1_mw"]
            processed["forecast"] = forecast_results["forecast_t1_mw"]
            processed["demand"] = forecast_results["demand_mw"]
            processed["net_balance_mw"] = forecast_results["net_balance_mw"]
            processed["grid_decision"] = forecast_results["decision"]
            processed["status"] = forecast_results["decision"]
            processed["grid_action"] = forecast_results["action"]
            processed["grid_frequency_hz"] = forecast_results["frequency_hz"]
            processed["model_type"] = forecast_results["model_type"]
        except Exception as e:
            logger.warning("[ML] Forecast exception on record %s: %s", timestamp, e)
            processed["forecast_t1_mw"] = round(total_renewable, 1)
            processed["forecast"] = round(total_renewable, 1)
            processed["status"] = "BALANCED"
            processed["grid_decision"] = "BALANCED"
    else:
        # Fallback if ML model is unavailable
        processed["forecast_t1_mw"] = round(total_renewable, 1)
        processed["forecast"] = round(total_renewable, 1)
        processed["demand"] = demand
        processed["status"] = "BALANCED"
        processed["grid_decision"] = "BALANCED"

    return processed, "OK"

def main():
    parser = argparse.ArgumentParser(description="Renewable Grid Stream Processor with ML")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="Kafka broker host:port")
    parser.add_argument("--input-topic", default=INPUT_TOPIC, help="Input raw topic")
    parser.add_argument("--output-topic", default=OUTPUT_TOPIC, help="Output processed topic")
    parser.add_argument("--group", default=GROUP_ID, help="Consumer group ID")
    parser.add_argument("--demand", type=float, default=DEFAULT_DEMAND, help="Grid demand baseline (MW)")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="Balancing deadband threshold (MW)")
    args = parser.parse_args()

    logger.info("Initializing Stream Processor with ML Forecasting...")
    logger.info("Connecting to broker: %s", args.broker)
    logger.info("Input topic: '%s' -> Output topic: '%s'", args.input_topic, args.output_topic)

    # Initialize Online ML Forecaster
    forecaster = None
    if ML_AVAILABLE:
        try:
            forecaster = OnlineEnergyForecaster()
            logger.info("Online ML Forecaster initialized with LightGBM champion model.")
        except Exception as e:
            logger.warning("Could not initialize Online ML Forecaster: %s. Continuing in baseline mode.", e)
    else:
        logger.warning("ML dependencies not available: %s", ML_IMPORT_ERR)

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
            processed_record, status = transform_and_forecast(
                raw_record, 
                forecaster=forecaster, 
                demand=args.demand, 
                threshold=args.threshold
            )

            if processed_record is None:
                logger.warning("[STREAM] Dropped malformed record: %s | Payload: %s", status, raw_record)
                continue

            # Forward to processed topic
            future = producer.send(args.output_topic, value=processed_record)
            meta = future.get(timeout=10)

            # Structured logging matching PRD Section 20
            forecast_val = processed_record.get("forecast_t1_mw", "N/A")
            decision = processed_record.get("grid_decision", "N/A")
            freq = processed_record.get("grid_frequency_hz", 50.0)

            print(
                f"[STREAM-ML] Processed | "
                f"timestamp={processed_record['timestamp']} | "
                f"Total={processed_record['total_renewable']} MW | "
                f"Forecast(t+1)={forecast_val} MW | "
                f"Grid={decision} ({freq} Hz) | "
                f"Partition={meta.partition} | Offset={meta.offset}"
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
