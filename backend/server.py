#!/usr/bin/env python3
"""
Renewable Energy Grid - FastAPI & WebSocket Real-Time Backend
=============================================================
Bridges Kafka streaming telemetry, online ML model inference,
PostgreSQL persistence, and the React frontend dashboard.

Endpoints:
- WebSocket /ws/telemetry : Real-time streaming feed pushed to frontend
- GET /api/health         : System health & component status
- GET /api/model/info     : Champion ML model metadata & metrics
- GET /api/records/recent : Recent buffer of streaming energy records
- POST /api/predict       : Ad-hoc next-hour forecast via champion model
- POST /api/grid/balance  : Dynamic grid balancing evaluation
"""

import os
import sys
import json
import time
import asyncio
import logging
import threading
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root and dataproc to path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "renewable-grid"))

from dataproc.predictor import OnlineEnergyForecaster

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("BACKEND")

app = FastAPI(
    title="Renewable Energy Grid Telemetry & Forecasting API",
    version="1.0.0",
    description="Real-Time Streaming, ML Forecasting & Grid Balancing Operations Engine"
)

# Enable CORS for React frontend (Vite default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory buffer of recent stream records
MAX_BUFFER_SIZE = 100
stream_buffer: List[Dict[str, Any]] = []
connected_clients: List[WebSocket] = []

# Initialize ML Forecaster
try:
    forecaster = OnlineEnergyForecaster(
        model_path=os.path.join(PROJECT_ROOT, "renewable-grid", "dataproc", "champion_model.joblib"),
        meta_path=os.path.join(PROJECT_ROOT, "renewable-grid", "dataproc", "model_metadata.json")
    )
    logger.info("Champion ML Forecaster initialized in Backend.")
except Exception as e:
    logger.warning("Could not initialize ML Forecaster in Backend: %s", e)
    forecaster = None

# Grid parameters
grid_state = {
    "demand": 7500.0,
    "threshold": 300.0,
    "battery_soc": 78.0,
    "kafka_connected": False,
    "total_records_processed": 51865
}

class PredictRequest(BaseModel):
    production: float
    timestamp: Optional[str] = None
    demand: Optional[float] = 7500.0
    threshold: Optional[float] = 300.0

class GridAdjustRequest(BaseModel):
    demand: Optional[float] = None
    threshold: Optional[float] = None
    battery_soc: Optional[float] = None

# --- REST Endpoints ---

@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "service": "Renewable Grid Stream & ML Backend",
        "timestamp": datetime.now().isoformat(),
        "ml_model_loaded": forecaster is not None,
        "kafka_connected": grid_state["kafka_connected"],
        "connected_ui_clients": len(connected_clients),
        "buffered_records": len(stream_buffer)
    }

@app.get("/api/model/info")
def get_model_info():
    if forecaster and forecaster.metadata:
        return forecaster.metadata
    return {"error": "Model metadata not loaded"}

@app.get("/api/records/recent")
def get_recent_records(limit: int = Query(30, ge=1, le=100)):
    return stream_buffer[-limit:]

@app.post("/api/predict")
def predict_adhoc(req: PredictRequest):
    if not forecaster:
        return {"error": "ML Forecaster not initialized"}
    ts = req.timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    res = forecaster.predict_stream(
        current_prod=req.production,
        timestamp_str=ts,
        demand=req.demand or grid_state["demand"],
        threshold=req.threshold or grid_state["threshold"]
    )
    return res

@app.post("/api/grid/adjust")
def adjust_grid(req: GridAdjustRequest):
    if req.demand is not None:
        grid_state["demand"] = float(req.demand)
    if req.threshold is not None:
        grid_state["threshold"] = float(req.threshold)
    if req.battery_soc is not None:
        grid_state["battery_soc"] = float(req.battery_soc)
    return {"status": "updated", "grid_state": grid_state}

# --- WebSocket Broadcast Manager ---

async def broadcast_record(record: Dict[str, Any]):
    stream_buffer.append(record)
    if len(stream_buffer) > MAX_BUFFER_SIZE:
        stream_buffer.pop(0)

    grid_state["total_records_processed"] += 1

    # Adjust battery SoC
    if record.get("status") == "SURPLUS":
        grid_state["battery_soc"] = min(100.0, grid_state["battery_soc"] + 0.5)
    elif record.get("status") == "DEFICIT":
        grid_state["battery_soc"] = max(10.0, grid_state["battery_soc"] - 0.5)

    dead_clients = []
    payload_str = json.dumps(record)
    for ws in connected_clients:
        try:
            await ws.send_text(payload_str)
        except Exception:
            dead_clients.append(ws)

    for dead in dead_clients:
        if dead in connected_clients:
            connected_clients.remove(dead)

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info("UI Client connected to WebSocket. Total clients: %d", len(connected_clients))

    # Send recent historical buffer immediately upon connection
    try:
        if stream_buffer:
            await websocket.send_text(json.dumps({
                "type": "INIT_HISTORY",
                "records": stream_buffer[-20:],
                "grid_state": grid_state
            }))

        while True:
            # Keepalive listener
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "SET_DEMAND":
                    grid_state["demand"] = float(msg.get("value", 7500))
            except Exception:
                pass
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info("UI Client disconnected. Remaining clients: %d", len(connected_clients))

# --- Kafka & MQTT Ingestion Workers ---

import socket

def is_socket_open(host: str, port: int, timeout: float = 0.8) -> bool:
    """Quickly check if a TCP port is open to avoid 40-second Kafka bootstrap blocking."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

# Timestamp of last received Wokwi MQTT telemetry packet
last_mqtt_packet_time = 0.0

def kafka_listener_worker(loop):
    broker = os.getenv("KAFKA_BROKER", "localhost:9092")
    topic = os.getenv("KAFKA_OUTPUT_TOPIC", "renewable-energy-processed")
    group = "backend-dashboard-consumer"

    host = broker.split(":")[0]
    port = int(broker.split(":")[1]) if ":" in broker else 9092

    if is_socket_open(host, port):
        try:
            from kafka import KafkaConsumer
            logger.info("Connecting to Kafka broker: %s topic: %s", broker, topic)
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=broker,
                group_id=group,
                auto_offset_reset="latest",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                consumer_timeout_ms=3000
            )
            grid_state["kafka_connected"] = True
            logger.info("Backend successfully connected to Kafka stream topic '%s'", topic)

            while True:
                for message in consumer:
                    record = message.value
                    record["partition"] = message.partition
                    record["offset"] = message.offset
                    asyncio.run_coroutine_threadsafe(broadcast_record(record), loop)
                time.sleep(0.1)
        except Exception as e:
            logger.info("Kafka consumer encountered an error (%s). Switching to hybrid MQTT/demo replay mode.", e)
            grid_state["kafka_connected"] = False
    else:
        logger.info("Kafka broker at %s:%d offline. Starting hybrid Wokwi MQTT + ML Forecaster mode.", host, port)
        grid_state["kafka_connected"] = False

    run_standalone_stream_simulator(loop)

def on_wokwi_mqtt_message(client, userdata, msg):
    """Processes incoming Wokwi ESP32 telemetry in real-time when Kafka is offline."""
    global last_mqtt_packet_time
    loop = userdata.get("loop")
    if not loop:
        return

    try:
        raw_text = msg.payload.decode("utf-8")
        payload = json.loads(raw_text)
    except Exception:
        return

    solar = float(payload.get("solar_production", 0.0))
    wind = float(payload.get("wind_production", 0.0))
    total_prod = float(payload.get("production", solar + wind))
    ts = payload.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Run Online ML Forecaster & Grid Balancing
    if forecaster:
        pred_res = forecaster.predict_stream(
            current_prod=total_prod,
            timestamp_str=ts,
            demand=grid_state["demand"],
            threshold=grid_state["threshold"]
        )
        forecast_val = pred_res["forecast_t1_mw"]
        status = pred_res["decision"]
        freq = pred_res["frequency_hz"]
        action = pred_res["action"]
    else:
        forecast_val = round(total_prod * 0.98, 1)
        status = "BALANCED"
        freq = 50.0
        action = "Synchronized"

    record = {
        "id": int(time.time() * 1000) % 1000000,
        "timestamp": ts,
        "hour": datetime.now().hour,
        "source": payload.get("source", "Wokwi-ESP32"),
        "device_id": payload.get("device_id", "esp32-renewable-station-01"),
        "wind": round(wind, 1),
        "solar": round(solar, 1),
        "total": round(total_prod, 1),
        "production": round(total_prod, 1),
        "temperature": payload.get("temperature", 25.0),
        "humidity": payload.get("humidity", 50.0),
        "forecast": forecast_val,
        "forecast_t1_mw": forecast_val,
        "demand": grid_state["demand"],
        "net_balance_mw": round(forecast_val - grid_state["demand"], 1),
        "status": status,
        "grid_decision": status,
        "grid_action": action,
        "frequency_hz": freq,
        "partition": 0,
        "offset": grid_state["total_records_processed"] + 1
    }

    last_mqtt_packet_time = time.time()
    asyncio.run_coroutine_threadsafe(broadcast_record(record), loop)

def run_standalone_stream_simulator(loop):
    """
    Connects to Wokwi MQTT broker and replays prototype dataset whenever
    Wokwi sensors are idle, ensuring real-time interactivity.
    """
    global last_mqtt_packet_time

    # Initialize Wokwi MQTT subscriber in background
    try:
        import paho.mqtt.client as mqtt
        mqtt_topic = "renewable-grid/iot/sensors"
        mqtt_broker = "broker.hivemq.com"
        client_id = f"backend-wokwi-sub-{int(time.time())}"
        
        try:
            mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id, userdata={"loop": loop})
        except AttributeError:
            mqtt_client = mqtt.Client(client_id=client_id, userdata={"loop": loop})
        
        mqtt_client.user_data_set({"loop": loop})
        mqtt_client.on_message = on_wokwi_mqtt_message
        mqtt_client.connect(mqtt_broker, 1883, 60)
        mqtt_client.subscribe(mqtt_topic)
        mqtt_client.loop_start()
        logger.info("Direct Wokwi MQTT listener active on '%s' (%s:1883)", mqtt_topic, mqtt_broker)
    except Exception as me:
        logger.warning("Could not start direct Wokwi MQTT listener: %s", me)

    proto_csv = os.path.join(PROJECT_ROOT, "renewable-grid", "data", "stream_prototype_data.csv")
    if not os.path.exists(proto_csv):
        return

    import pandas as pd
    try:
        df = pd.read_csv(proto_csv)
    except Exception as e:
        logger.error("Could not load prototype dataset: %s", e)
        return

    logger.info("Ready for live Wokwi ESP32 packets. Replaying baseline stream (%d records) when idle...", len(df))
    idx = 0
    while True:
        # If live Wokwi packets arrived in the last 4 seconds, pause dataset replay
        if time.time() - last_mqtt_packet_time < 4.0:
            time.sleep(1.0)
            continue

        row = df.iloc[idx % len(df)]
        idx += 1

        source = str(row.get("Source", "Wind"))
        total_prod = float(row.get("Production", 5000.0))
        solar_prod = total_prod if source == "Solar" else 0.0
        wind_prod = total_prod if source == "Wind" else 0.0
        ts = f"{row.get('Date', '2025-05-01')} {int(row.get('Start_Hour', 12)):02d}:00"

        # Run real-time ML prediction
        if forecaster:
            pred_res = forecaster.predict_stream(
                current_prod=total_prod,
                timestamp_str=ts,
                demand=grid_state["demand"],
                threshold=grid_state["threshold"]
            )
            forecast_val = pred_res["forecast_t1_mw"]
            status = pred_res["decision"]
            freq = pred_res["frequency_hz"]
            action = pred_res["action"]
        else:
            forecast_val = round(total_prod * 0.98, 1)
            status = "BALANCED"
            freq = 50.0
            action = "Synchronized"

        record = {
            "id": int(time.time() * 1000) % 1000000,
            "timestamp": ts,
            "hour": int(row.get("Start_Hour", 12)),
            "source": source,
            "wind": round(wind_prod, 1),
            "solar": round(solar_prod, 1),
            "total": round(total_prod, 1),
            "production": round(total_prod, 1),
            "forecast": forecast_val,
            "forecast_t1_mw": forecast_val,
            "demand": grid_state["demand"],
            "net_balance_mw": round(forecast_val - grid_state["demand"], 1),
            "status": status,
            "grid_decision": status,
            "grid_action": action,
            "frequency_hz": freq,
            "partition": 0,
            "offset": 51865 + idx
        }

        asyncio.run_coroutine_threadsafe(broadcast_record(record), loop)
        time.sleep(2.0)

@app.on_event("startup")
def startup_event():
    loop = asyncio.get_event_loop()
    t = threading.Thread(target=kafka_listener_worker, args=(loop,), daemon=True)
    t.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
