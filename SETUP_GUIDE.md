# Renewable Energy Grid - Setup Guide & Roadmap

This document outlines the setup process for **Wokwi IoT Simulation**, **Apache Kafka (KRaft mode)**, and details the remaining deliverables to complete the project.

---

## 1. Wokwi IoT Sensor Setup

The edge layer simulates a renewable energy telemetry node using an ESP32 microcontroller and physical sensors simulated in [Wokwi](https://wokwi.com).

### Hardware & Sensor Mapping

| Component | Pin | Simulated Metric | Scale |
|---|---|---|---|
| **ESP32 DevKit V4** | Core | Microcontroller & WiFi Stack | — |
| **Photoresistor (LDR)** | `GPIO 34` | Solar Farm Irradiance | 0 – 500 MW |
| **Potentiometer** | `GPIO 35` | Wind Turbine Speed | 0 – 650 MW |
| **DHT22** | `GPIO 4` | Ambient Temp & Humidity | °C, % |
| **SSD1306 OLED** | `GPIO 21` (SDA), `GPIO 22` (SCL) | Live Telemetry HUD | 128×64 px |
| **Status LED** | `GPIO 2` | MQTT TX Heartbeat | Flashes on send |

### Steps to Run on Wokwi

1. Open [Wokwi](https://wokwi.com) in your web browser.
2. Select **ESP32** from the starter templates.
3. Switch to the **`diagram.json`** tab and paste the contents of:
   `renewable-grid/iot-sensor/diagram.json`
4. Switch to the **`sketch.ino`** tab and paste the contents of:
   `renewable-grid/iot-sensor/sketch.ino`
5. Open the **Library Manager** (or `libraries.txt`) and add:
   ```text
   PubSubClient
   ArduinoJson
   Adafruit SSD1306
   Adafruit GFX Library
   DHT sensor library
   Adafruit Unified Sensor
   ```
6. Click the green **Play (▶ Start Simulation)** button.
   * The Serial Monitor will show connection to `Wokwi-GUEST` and `broker.hivemq.com:1883`.
   * The OLED display will light up with real-time MW metrics.
7. Drag the **Photoresistor** or **Potentiometer** sliders to adjust solar and wind output in real time.

### Starting the Ingestion Gateway

The gateway bridges incoming Wokwi MQTT telemetry to Kafka topic `renewable-energy`:

```powershell
# With Kafka running:
py -3.13 "renewable-grid\iot-bridge\iot_bridge.py" --kafka-broker localhost:9092

# Monitor mode (if Kafka is not running yet):
py -3.13 "renewable-grid\iot-bridge\iot_bridge.py" --no-kafka
```

---

## 2. Apache Kafka Setup (KRaft Mode on Windows)

> **Prerequisite:** Java JDK 21 is already installed on your machine at `C:\Program Files\Java\jdk-21`.

### Step 2.1: Download & Extract Kafka
1. Download Apache Kafka 3.9.x (Scala 2.13 binary) from [Apache Kafka Downloads](https://downloads.apache.org/kafka/3.9.0/kafka_2.13-3.9.0.tgz).
2. Extract the archive to a short path to avoid Windows path length limitations:
   * Recommended: `D:\kafka` or `C:\kafka`

### Step 2.2: Initialize KRaft Cluster ID (No ZooKeeper required)
Open PowerShell or Command Prompt in your Kafka directory:

```powershell
cd D:\kafka

# Generate a unique cluster ID
$CLUSTER_ID = .\bin\windows\kafka-storage.bat random-uuid

# Format the storage log directory
.\bin\windows\kafka-storage.bat format -t $CLUSTER_ID -c .\config\kraft\server.properties
```

### Step 2.3: Start the Kafka Broker
```powershell
.\bin\windows\kafka-server-start.bat .\config\kraft\server.properties
```
*Kafka is now listening at `localhost:9092`.*

### Step 2.4: Create Required Topics
Open a second PowerShell window:

```powershell
cd D:\kafka

# Create raw input topic
.\bin\windows\kafka-topics.bat --create --topic renewable-energy --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

# Create processed output topic
.\bin\windows\kafka-topics.bat --create --topic renewable-energy-processed --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

# Verify topics
.\bin\windows\kafka-topics.bat --list --bootstrap-server localhost:9092
```

---

## 3. Running the Data Pipeline

Once Kafka is running:

1. **Start the Stream Processor:**
   ```powershell
   py -3.13 "renewable-grid\streams\stream_processor.py"
   ```
   *(Consumes from `renewable-energy`, validates, computes `total_renewable`, and publishes to `renewable-energy-processed`).*

2. **Start the Subscriber & PostgreSQL Ingestion:**
   ```powershell
   py -3.13 "renewable-grid\subscriber\subscriber.py"
   ```
   *(Consumes from `renewable-energy-processed`, outputs structured logs, and inserts readings into PostgreSQL).*

3. **Start the IoT Ingestion Gateway:**
   ```powershell
   py -3.13 "renewable-grid\iot-bridge\iot_bridge.py"
   ```

4. **Start the Wokwi Simulation** in your browser. Live readings will flow from your browser into Kafka and PostgreSQL!

---

## 4. What's Left to be Done (Project Roadmap)

The project currently has the ingestion, edge simulation, and core streaming layers in place. The remaining components are:

### Deliverable A: PostgreSQL Database Setup (PRD Phase 5)
- [ ] Ensure local PostgreSQL instance is running with database `renewable_energy`.
- [ ] Execute `renewable-grid/database/schema.sql` to create `energy_readings` and summary views.
- [ ] Configure database credentials in `.env` (copy from `renewable-grid/.env.example`).

### Deliverable B: Machine Learning Forecasting Layer (PRD Phase 6)
- [ ] **Feature Engineering:** Build feature matrix from stored historical data (lagged features $t-1, t-2$, rolling 3h/6h averages, hour-of-day, day-of-week).
- [ ] **Model Training:** Train regression models (Random Forest / XGBoost / Ridge) to predict next-hour generation ($t+1$).
- [ ] **Evaluation:** Evaluate with MAE, RMSE, and $R^2$ metrics.
- [ ] **Inference Service:** A script to load the trained model and output live next-hour predictions for incoming streaming events.

### Deliverable C: Grid Balancing Decision Engine (PRD Phase 7)
- [ ] **Balancing Rule Engine:** Compute net balance:
  $$\text{Net Balance} = \text{Forecast Generation} - \text{Expected Demand}$$
- [ ] **State Classification:** Output `SURPLUS`, `DEFICIT`, or `BALANCED` states based on configurable thresholds.
- [ ] **Actionable Recommendations:** Suggest battery storage charging/discharging, conventional backup dispatch, or curtailment.

### Deliverable D: Connect React Frontend to Live Backend
- [ ] Currently, `frontend/src/App.jsx` uses simulated client-side timers.
- [ ] Build a lightweight FastAPI / WebSocket backend (`backend/server.py`) that reads live messages from Kafka and queries PostgreSQL history.
- [ ] Connect the React dashboard to this API so the live charts, topology view, and balancing banner reflect real streaming data.
