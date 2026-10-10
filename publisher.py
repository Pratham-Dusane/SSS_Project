from kafka import KafkaProducer
import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("PUBLISHER")

producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: v.encode("utf-8")
)

TOPIC = "test-topic"

logger.info("Publisher started")
logger.info("Connected to Kafka at localhost:9092")

try:
    while True:
        message = input("Enter message: ")

        if message.lower() == "exit":
            break

        future = producer.send(TOPIC, value=message)

        # Wait for Kafka to confirm the message
        metadata = future.get(timeout=10)

        logger.info(
            "Published: '%s' | topic=%s | partition=%s | offset=%s",
            message,
            metadata.topic,
            metadata.partition,
            metadata.offset
        )

except KeyboardInterrupt:
    logger.info("Publisher interrupted")

finally:
    producer.flush()
    producer.close()
    logger.info("Publisher stopped")