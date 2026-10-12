# End-to-End Operations Runbook: Wokwi to Dashboard

This document provides a concise, step-by-step guide to run the entire **Renewable Energy Streaming, ML Forecasting & Grid Balancing System** from edge IoT sensors to the operations dashboard.

---

## 🏗️ Architecture Pipeline

```text
[Wokwi ESP32 / Mock Sensor]
         │ MQTT (broker.hivemq.com:1883)
         ▼
[IoT Bridge: iot_bridge.py]
         │ Kafka: 'renewable-energy'
         ▼
[Apache Kafka Broker (localhost:9092)]
         │
         ▼
[Stream Processor + LightGBM Model: stream_processor.py]
         │ • Computes Total & Wind/Solar %
         │ • Real-time 31-feature extraction
         │ • Predicts t+1 generation (Champion ML Model)
         │ • Evaluates Grid State (Surplus / Balanced / Deficit)
         │
         │ Kafka: 'renewable-energy-processed'
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[Subscriber: subscriber.py]               [FastAPI Backend: server.py]
• Logs to terminal                        • WebSocket at /ws/telemetry
• Persists to PostgreSQL                  • REST endpoints at /api/*
                                                   │
                                                   ▼ WebSocket
                                          [React Dashboard: App.jsx]
                                          • Live charts & telemetry HUD
                                          • Frequency synchronization
                                          • Real-time AI forecast curve
```

---

## ⚡ Quickstart: Running the System in 3 Terminals

### Terminal 1 — Start the Backend (FastAPI + WebSocket)
```bash
python3 backend/server.py
```
* **URL:** `http://localhost:8000`
* **WebSocket:** `ws://localhost:8000/ws/telemetry`
* *Auto-Fallback:* If Kafka is not running, the backend automatically replays stream data through the **real LightGBM champion model** so you can demo the full UI instantly!

---

### Terminal 2 — Start the React Dashboard
```bash
npm run dev
```
* Open your browser at **`http://localhost:5173`**.
* The top header will display **`LIVE BACKEND (WS)`** in green with a pulsating dot, confirming real-time telemetry streaming!

---

### Terminal 3 — Edge IoT Ingestion & Stream Processing

#### Option A: With Local Kafka Running
1. **Start the Stream Processor with Online ML:**
   ```bash
   python3 renewable-grid/streams/stream_processor.py
   ```
2. **Start the IoT Ingestion Gateway (MQTT $\to$ Kafka):**
   ```bash
   python3 renewable-grid/iot-bridge/iot_bridge.py
   ```
3. **Start the Wokwi Edge Simulator** (see section below) or the mock publisher:
   ```bash
   python3 renewable-grid/iot-sensor/test_mock_publisher.py
   ```

#### Option B: Standalone IoT Testing (No Kafka Needed)
Verify Wokwi sensor data over MQTT without starting Kafka:
```bash
python3 renewable-grid/iot-bridge/iot_bridge.py --no-kafka
```

---

## 🕹️ How to Simulate Wokwi Sensors Step-by-Step

### Step 1: Open Wokwi
Go to [https://wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32) in your browser.

### Step 2: Paste Circuit & Firmware Files
1. **Circuit:** Click the **`diagram.json`** tab and paste the contents of [`renewable-grid/iot-sensor/diagram.json`](./renewable-grid/iot-sensor/diagram.json).
2. **Code:** Click the **`sketch.ino`** tab and paste the contents of [`renewable-grid/iot-sensor/sketch.ino`](./renewable-grid/iot-sensor/sketch.ino).
3. **Libraries:** Click **Library Manager** (or `libraries.txt`) and ensure these 6 libraries are present:
   ```text
   PubSubClient
   ArduinoJson
   Adafruit SSD1306
   Adafruit GFX Library
   DHT sensor library
   Adafruit Unified Sensor
   ```

### Step 3: Run the Simulation
1. Click the green **Play (▶ Start Simulation)** button.
2. The virtual ESP32 connects to `Wokwi-GUEST` WiFi and the public MQTT broker (`broker.hivemq.com:1883`).
3. The virtual **SSD1306 OLED screen** lights up displaying live Solar MW, Wind MW, Total MW, and packet sequence count.

### Step 4: Interact with the Sensors
* **Adjust Solar:** Click the **Photoresistor (LDR)** component. Drag the sunlight slider to simulate changing solar irradiance (0 to 500 MW).
* **Adjust Wind:** Click and rotate the **Potentiometer** dial to simulate rising or falling wind turbine output (0 to 650 MW).
* **Adjust Climate:** Click the **DHT22** sensor to vary ambient temperature and humidity.
* **Transmission Heartbeat:** The built-in status LED flashes every 2 seconds as packets are published to MQTT topic `renewable-grid/iot/sensors`.

---

## 📊 Summary of Commands

| Action | Command |
|---|---|
| **Start UI Dashboard** | `npm run dev` |
| **Start Backend API + WebSocket** | `npm run backend` *(or `python3 backend/server.py`)* |
| **Start Stream Processor (ML + Grid Rules)** | `npm run processor` *(or `python3 renewable-grid/streams/stream_processor.py`)* |
| **Start IoT Gateway Bridge** | `npm run iot-bridge` *(or `python3 renewable-grid/iot-bridge/iot_bridge.py`)* |
| **Start SQL Ingestion Subscriber** | `npm run subscriber` *(or `python3 renewable-grid/subscriber/subscriber.py`)* |
| **Terminal Mock Sensor (No Browser)** | `python3 renewable-grid/iot-sensor/test_mock_publisher.py` |
| **Build Frontend for Production** | `npm run build` |
