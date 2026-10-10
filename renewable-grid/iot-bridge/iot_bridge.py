#!/usr/bin/env python3
"""
Renewable Energy Grid - IoT Ingestion Gateway (MQTT to Kafka Bridge)
====================================================================
Subscribes to live sensor telemetry from Wokwi ESP32 nodes over MQTT,
validates data against PRD Guardrails (Section 17.1), enriches the payload,
and produces real-time streaming events to Kafka topic 'renewable-energy'.
"""

import os
import sys
import json
import math
import time
import signal
import logging
import argparse
from datetime import datetime

# Configure structured logging matching PRD Section 20
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("IOT-GATEWAY")

# Default configurations
DEFAULT_MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
DEFAULT_MQTT_PORT   = int(os.getenv("MQTT_PORT", "1883"))
DEFAULT_MQTT_TOPIC  = os.getenv("MQTT_TOPIC", "renewable-grid/iot/sensors")

DEFAULT_KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
DEFAULT_KAFKA_TOPIC  = os.getenv("KAFKA_TOPIC", "renewable-energy")

# Global counters
stats = {
    "received": 0,
    "forwarded": 0,
    "rejected": 0,
    "start_time": time.time()
}

kafka_producer = None
running = True

def validate_telemetry(payload):
    """
    Validates IoT payload according to PRD Section 17.1:
    - Enforce required numerical values
    - Disallow NaN, infinite, or negative production values
    - Preserve or generate valid timestamps
    """
    if not isinstance(payload, dict):
        return False, "Payload is not a valid JSON object"

    # Extract or validate production fields
    solar = payload.get("solar_production")
    wind = payload.get("wind_production")
    total = payload.get("production")

    if solar is None and wind is None and total is None:
        return False, "Missing production readings (solar_production or wind_production)"

    # Validate solar
    if solar is not None:
        if not isinstance(solar, (int, float)) or math.isnan(solar) or math.isinf(solar) or solar < 0:
            return False, f"Invalid solar production value: {solar}"
    else:
        solar = 0.0

    # Validate wind
    if wind is not None:
        if not isinstance(wind, (int, float)) or math.isnan(wind) or math.isinf(wind) or wind < 0:
            return False, f"Invalid wind production value: {wind}"
    else:
        wind = 0.0

    # Validate total
    if total is not None:
        if not isinstance(total, (int, float)) or math.isnan(total) or math.isinf(total) or total < 0:
            return False, f"Invalid total production value: {total}"
    else:
        total = round(solar + wind, 2)

    return True, "Valid"

def normalize_event(payload):
    """Normalizes raw IoT sensor payload into standard Kafka stream event."""
    solar = float(payload.get("solar_production", 0.0))
    wind = float(payload.get("wind_production", 0.0))
    total = float(payload.get("production", solar + wind))
    
    timestamp = payload.get("timestamp")
    if not timestamp or str(timestamp).strip() == "":
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    event = {
        "timestamp": str(timestamp),
        "source": payload.get("source", "Wokwi-IoT-ESP32"),
        "device_id": payload.get("device_id", "esp32-renewable-station-01"),
        "sequence": payload.get("sequence", 0),
        "wind_production": round(wind, 2),
        "solar_production": round(solar, 2),
        "production": round(total, 2),
        "temperature": payload.get("temperature", 25.0),
        "humidity": payload.get("humidity", 50.0),
        "unit": payload.get("unit", "MW"),
        "gateway_ingested_at": datetime.now().isoformat()
    }
    return event

def init_kafka(broker):
    """Attempts to connect to Apache Kafka broker."""
    try:
        from kafka import KafkaProducer
        logger.info("Connecting to Kafka broker at %s...", broker)
        producer = KafkaProducer(
            bootstrap_servers=broker,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            retries=3,
            max_block_ms=5000
        )
        logger.info("[KAFKA] Connected successfully to broker at %s", broker)
        return producer
    except Exception as e:
        logger.warning("[KAFKA] Broker at %s unavailable (%s). Running in MQTT-only monitor mode.", broker, e)
        return None

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker."""
    if rc == 0:
        logger.info("[MQTT] Connected to broker: %s:%d", userdata["broker"], userdata["port"])
        client.subscribe(userdata["topic"])
        logger.info("[MQTT] Subscribed to topic: '%s'", userdata["topic"])
        print("\n" + "=" * 65)
        print("  GATEWAY ACTIVE: Waiting for Wokwi ESP32 telemetry...")
        print("=" * 65 + "\n")
    else:
        logger.error("[MQTT] Connection failed with error code: %d", rc)

def on_message(client, userdata, msg):
    """Callback when an MQTT message arrives from Wokwi."""
    global stats, kafka_producer
    stats["received"] += 1

    try:
        raw_text = msg.payload.decode("utf-8")
        payload = json.loads(raw_text)
    except Exception as e:
        stats["rejected"] += 1
        logger.warning("[GUARDRAIL] Discarded non-JSON message: %s", e)
        return

    is_valid, reason = validate_telemetry(payload)
    if not is_valid:
        stats["rejected"] += 1
        logger.warning("[GUARDRAIL] Rejected invalid record: %s | Data: %s", reason, payload)
        return

    event = normalize_event(payload)

    # Forward to Kafka if available
    kafka_topic = userdata.get("kafka_topic", DEFAULT_KAFKA_TOPIC)
    if kafka_producer:
        try:
            future = kafka_producer.send(kafka_topic, value=event)
            meta = future.get(timeout=5)
            stats["forwarded"] += 1

            # PRD Section 20 structured log format
            print(
                f"[IOT-GATEWAY] Ingested MQTT seq={event['sequence']} -> Kafka [{meta.topic}] | "
                f"Dev={event['device_id']} | "
                f"Solar={event['solar_production']} MW | "
                f"Wind={event['wind_production']} MW | "
                f"Total={event['production']} MW | "
                f"Partition={meta.partition} | "
                f"Offset={meta.offset}"
            )
            return
        except Exception as ke:
            logger.error("[KAFKA] Send failed: %s", ke)

    # Fallback log when Kafka is not running (e.g. initial testing)
    stats["forwarded"] += 1
    print(
        f"[IOT-GATEWAY] Ingested MQTT seq={event['sequence']} (Kafka offline) | "
        f"Dev={event['device_id']} | "
        f"Solar={event['solar_production']} MW | "
        f"Wind={event['wind_production']} MW | "
        f"Total={event['production']} MW | "
        f"Temp={event['temperature']}C"
    )

def handle_exit(sig, frame):
    global running
    print("\n[IOT-GATEWAY] Shutting down gateway...")
    running = False

def main():
    global kafka_producer, running

    parser = argparse.ArgumentParser(description="Renewable Grid IoT Ingestion Gateway (MQTT -> Kafka)")
    parser.add_argument("--mqtt-broker", default=DEFAULT_MQTT_BROKER, help="MQTT Broker host")
    parser.add_argument("--mqtt-port", type=int, default=DEFAULT_MQTT_PORT, help="MQTT Broker port")
    parser.add_argument("--mqtt-topic", default=DEFAULT_MQTT_TOPIC, help="MQTT topic to subscribe to")
    parser.add_argument("--kafka-broker", default=DEFAULT_KAFKA_BROKER, help="Kafka broker host:port")
    parser.add_argument("--kafka-topic", default=DEFAULT_KAFKA_TOPIC, help="Kafka topic to publish to")
    parser.add_argument("--no-kafka", action="store_true", help="Run in MQTT-only monitor mode (no Kafka)")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # Try importing paho.mqtt
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        logger.error("Missing dependency 'paho-mqtt'. Please install it using: pip install paho-mqtt")
        sys.exit(1)

    # Initialize Kafka connection
    if not args.no_kafka:
        kafka_producer = init_kafka(args.kafka_broker)
    else:
        logger.info("Kafka disabled via --no-kafka flag. Operating in monitor mode.")

    # Initialize MQTT client
    userdata = {
        "broker": args.mqtt_broker,
        "port": args.mqtt_port,
        "topic": args.mqtt_topic,
        "kafka_topic": args.kafka_topic
    }

    client_id = f"gateway-{int(time.time())}"
    # Support both paho-mqtt v1 and v2
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=client_id, userdata=userdata)
    except AttributeError:
        client = mqtt.Client(client_id=client_id, userdata=userdata)

    client.user_data_set(userdata)
    client.on_connect = on_connect
    client.on_message = on_message

    logger.info("Connecting to MQTT broker at %s:%d...", args.mqtt_broker, args.mqtt_port)
    try:
        client.connect(args.mqtt_broker, args.mqtt_port, keepalive=60)
    except Exception as e:
        logger.error("Failed to connect to MQTT broker: %s", e)
        sys.exit(1)

    client.loop_start()

    try:
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()
        if kafka_producer:
            kafka_producer.flush()
            kafka_producer.close()
        logger.info(
            "Gateway stopped. Stats: Received=%d, Forwarded=%d, Rejected=%d",
            stats["received"], stats["forwarded"], stats["rejected"]
        )

if __name__ == "__main__":
    main()
