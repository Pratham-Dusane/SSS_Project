# Streams Layer

This module provides real-time validation, enrichment, and transformation between the raw `renewable-energy` topic and the processed `renewable-energy-processed` topic.

## Options Available

### Option 1: Python Stream Processor (Fastest for testing)
Runs directly without requiring Maven or Java packaging:
```bash
python stream_processor.py
```

### Option 2: Java Kafka Streams (PRD Section 9)
When Maven is installed:
```bash
mvn clean package
java -jar target/renewable-streams-1.0.0-jar-with-dependencies.jar
```
