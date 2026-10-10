# Renewable Energy Streaming, Forecasting & Grid Balancing System

An end-to-end real-time data streaming pipeline using **Apache Kafka**, **Kafka Streams / Stream Processing**, **PostgreSQL**, and **Python**.

---

## 📁 Project Structure

```text
renewable-grid/
│
├── producer/
│   └── producer.py                # Replays dataset records into 'renewable-energy' topic
│
├── subscriber/
│   └── subscriber.py              # Consumes 'renewable-energy-processed' & writes to PostgreSQL
│
├── streams/
│   ├── stream_processor.py        # Python stream processor (real-time validation & metrics)
│   ├── src/main/java/...          # Java Kafka Streams application (PRD Section 9)
│   ├── pom.xml                    # Maven build file for Kafka Streams
│   └── README.md
│
├── database/
│   └── schema.sql                 # PostgreSQL DDL tables, indexes, and views
│
├── data/
│   └── renewable_energy.csv       # Historical energy production dataset (51,864 rows)
│
├── requirements.txt               # Python package dependencies
└── .env.example                   # Environment configuration template
```

---

## 🚀 Quickstart Guide

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Database
```bash
psql -U postgres -d renewable_energy -f database/schema.sql
```

### 3. Start Stream Processor
In terminal 1:
```bash
python streams/stream_processor.py
```

### 4. Start Subscriber
In terminal 2:
```bash
python subscriber/subscriber.py
```

### 5. Start Producer
In terminal 3:
```bash
python producer/producer.py --interval 1.0
```
