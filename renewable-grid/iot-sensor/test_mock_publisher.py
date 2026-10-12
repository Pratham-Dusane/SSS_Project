#!/usr/bin/env python3
"""
Mock Wokwi ESP32 Publisher
Simulates the Wokwi ESP32 node sending MQTT packets to broker.hivemq.com
Useful for quick testing without opening the web browser.
"""

import time
import json
import random
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: paho-mqtt not installed. Run: pip install paho-mqtt")
    exit(1)

BROKER = "broker.hivemq.com"
PORT = 1883
TOPIC = "renewable-grid/iot/sensors"

try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"mock-wokwi-{random.randint(1000, 9999)}")
except AttributeError:
    client = mqtt.Client(client_id=f"mock-wokwi-{random.randint(1000, 9999)}")
print(f"Connecting to MQTT broker: {BROKER}:{PORT}...")
client.connect(BROKER, PORT, 60)
client.loop_start()

print(f"Publishing simulated IoT telemetry to topic '{TOPIC}' every 2 seconds. Press Ctrl+C to stop.\n")

seq = 0
try:
    while True:
        seq += 1
        # Simulate diurnal solar cycle and wind gusts
        solar_mw = round(random.uniform(200.0, 480.0), 1)
        wind_mw = round(random.uniform(250.0, 600.0), 1)
        total_mw = round(solar_mw + wind_mw, 1)
        temp_c = round(random.uniform(24.0, 32.0), 1)
        humidity = round(random.uniform(40.0, 65.0), 1)

        payload = {
            "device_id": "esp32-renewable-station-01",
            "sequence": seq,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source": "Wokwi-IoT-ESP32",
            "solar_production": solar_mw,
            "wind_production": wind_mw,
            "production": total_mw,
            "temperature": temp_c,
            "humidity": humidity,
            "unit": "MW"
        }

        client.publish(TOPIC, json.dumps(payload))
        print(f"[MOCK-WOKWI] #{seq} Published -> Solar: {solar_mw} MW | Wind: {wind_mw} MW | Total: {total_mw} MW")
        time.sleep(2)
except KeyboardInterrupt:
    print("\nStopped mock publisher.")
finally:
    client.loop_stop()
    client.disconnect()
