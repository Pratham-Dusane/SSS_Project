from kafka import KafkaConsumer
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

logger = logging.getLogger("SUBSCRIBER")

consumer = KafkaConsumer(
    "test-topic",
    bootstrap_servers="localhost:9092",
    group_id="python-subscriber-group",
    auto_offset_reset="earliest",
    enable_auto_commit=True,
    value_deserializer=lambda v: v.decode("utf-8")
)

logger.info("Subscriber started")
logger.info("Connected to Kafka at localhost:9092")
logger.info("Listening on topic: test-topic")

try:
    for message in consumer:

        logger.info(
            "Received: '%s' | topic=%s | partition=%s | offset=%s",
            message.value,
            message.topic,
            message.partition,
            message.offset
        )

except KeyboardInterrupt:
    logger.info("Subscriber interrupted")

finally:
    consumer.close()
    logger.info("Subscriber stopped")