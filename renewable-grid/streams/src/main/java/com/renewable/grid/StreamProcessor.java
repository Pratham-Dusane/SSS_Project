package com.renewable.grid;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Produced;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Properties;

/**
 * Kafka Streams processor for Renewable Energy Grid (PRD Section 9).
 * Consumes raw events from 'renewable-energy', validates records,
 * computes total renewable energy, and produces to 'renewable-energy-processed'.
 */
public class StreamProcessor {

    private static final Logger logger = LoggerFactory.getLogger(StreamProcessor.class);
    private static final ObjectMapper mapper = new ObjectMapper();

    public static final String INPUT_TOPIC = "renewable-energy";
    public static final String OUTPUT_TOPIC = "renewable-energy-processed";
    public static final String APPLICATION_ID = "renewable-grid-streams-app";
    public static final String BOOTSTRAP_SERVERS = "localhost:9092";

    public static void main(String[] args) {
        Properties config = new Properties();
        config.put(StreamsConfig.APPLICATION_ID_CONFIG, APPLICATION_ID);
        config.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, BOOTSTRAP_SERVERS);
        config.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        config.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());

        StreamsBuilder builder = new StreamsBuilder();

        // 1. Consume from input topic
        KStream<String, String> inputStream = builder.stream(
                INPUT_TOPIC,
                Consumed.with(Serdes.String(), Serdes.String())
        );

        // 2. Validate, transform, and calculate derived features
        KStream<String, String> processedStream = inputStream
                .filter((key, value) -> value != null && !value.trim().isEmpty())
                .mapValues(value -> {
                    try {
                        JsonNode root = mapper.readTree(value);
                        if (!root.isObject()) {
                            return null;
                        }

                        ObjectNode obj = (ObjectNode) root;

                        double wind = obj.has("wind_production") ? obj.get("wind_production").asDouble(0.0) : 0.0;
                        double solar = obj.has("solar_production") ? obj.get("solar_production").asDouble(0.0) : 0.0;
                        double production = obj.has("production") ? obj.get("production").asDouble(wind + solar) : (wind + solar);

                        double total = (wind > 0 || solar > 0) ? (wind + solar) : production;
                        double windPct = total > 0 ? Math.round((wind / total) * 10000.0) / 100.0 : 0.0;
                        double solarPct = total > 0 ? Math.round((solar / total) * 10000.0) / 100.0 : 0.0;

                        obj.put("total_renewable", Math.round(total * 100.0) / 100.0);
                        obj.put("wind_percentage", windPct);
                        obj.put("solar_percentage", solarPct);

                        String resultJson = mapper.writeValueAsString(obj);
                        System.out.printf("[STREAM] Processed record | timestamp=%s | total_generation=%.2f MW%n",
                                obj.has("timestamp") ? obj.get("timestamp").asText() : "N/A", total);

                        return resultJson;
                    } catch (Exception e) {
                        logger.warn("Malformed record dropped: {}", value, e);
                        return null;
                    }
                })
                .filter((key, value) -> value != null);

        // 3. Publish to output topic
        processedStream.to(
                OUTPUT_TOPIC,
                Produced.with(Serdes.String(), Serdes.String())
        );

        KafkaStreams streams = new KafkaStreams(builder.build(), config);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            logger.info("Closing Kafka Streams application...");
            streams.close();
            logger.info("Kafka Streams application closed.");
        }));

        logger.info("Starting Renewable Grid Kafka Streams application...");
        streams.start();
    }
}
