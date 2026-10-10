# Wokwi ESP32 IoT Sensor Simulator

This directory contains the edge circuit and firmware code to simulate a real-world renewable energy telemetry station using [Wokwi](https://wokwi.com).

---

## Simulated Hardware

| Component | Pin | Simulated Function |
|---|---|---|
| **ESP32 DevKit V4** | Core | Microcontroller with WiFi & MQTT stack |
| **Photoresistor (LDR)** | `GPIO 34` (Analog) | Solar farm irradiance / Solar generation (0 - 500 MW) |
| **Potentiometer** | `GPIO 35` (Analog) | Wind turbine anemometer / Wind generation (0 - 650 MW) |
| **DHT22 Sensor** | `GPIO 4` (Digital) | Ambient temperature (°C) and humidity (%) |
| **SSD1306 OLED** | `GPIO 21` (SDA), `GPIO 22` (SCL) | Live station telemetry HUD & status display |
| **Status LED** | `GPIO 2` | Pulses on every MQTT transmission |

---

## Step-by-Step Instructions to Run on Wokwi

### Step 1: Open Wokwi
1. Go to [https://wokwi.com](https://wokwi.com) in your browser.
2. Under **Start from Scratch**, select **ESP32** (or click [Wokwi ESP32 Starter](https://wokwi.com/projects/new/esp32)).

### Step 2: Copy `diagram.json`
1. In the Wokwi editor, click on the **`diagram.json`** tab (if not visible, click the menu or switch tabs).
2. Replace all its content with the contents of [`renewable-grid/iot-sensor/diagram.json`](./diagram.json).
3. The circuit canvas will immediately render the ESP32, OLED display, LDR, potentiometer, DHT22, and wiring connections.

### Step 3: Copy `sketch.ino`
1. Switch back to the **`sketch.ino`** tab.
2. Replace all its content with the contents of [`renewable-grid/iot-sensor/sketch.ino`](./sketch.ino).

### Step 4: Add Libraries
1. In Wokwi, click the **Library Manager** tab (or `libraries.txt`).
2. Add the following libraries (or paste the lines from [`renewable-grid/iot-sensor/libraries.txt`](./libraries.txt)):
   - `PubSubClient`
   - `ArduinoJson`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
   - `DHT sensor library`
   - `Adafruit Unified Sensor`

### Step 5: Start the Simulation
1. Click the green **"Start Simulation"** (Play ▶) button.
2. Watch the Serial Monitor:
   - Connects to virtual WiFi (`Wokwi-GUEST`).
   - Connects to public MQTT broker (`broker.hivemq.com:1883`).
   - Obtains time synchronization via NTP.
   - Begins publishing JSON packets to topic: `renewable-grid/iot/sensors` every 2 seconds.
3. Observe the OLED screen showing live Solar MW, Wind MW, Total MW, and sequence count.

### Step 6: Interactive Live Testing
- Click on the **Photoresistor (LDR)** and drag the brightness slider to see solar production change in real time.
- Click and drag the **Potentiometer** to simulate rising or falling wind turbine speed.
- The OLED screen and published MQTT packets will instantly reflect your adjustments!
