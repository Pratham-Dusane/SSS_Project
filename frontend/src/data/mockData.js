// Initial telemetry and historical data modeled after the project dataset
export const initialEnergyRecords = [
  { id: 101, timestamp: "2025-11-30 08:00", hour: 8, wind: 4801, solar: 1250, total: 6051, forecast: 5900, demand: 5800, offset: 14201, partition: 0, status: "SURPLUS" },
  { id: 102, timestamp: "2025-11-30 09:00", hour: 9, wind: 5100, solar: 2400, total: 7500, forecast: 7300, demand: 6800, offset: 14202, partition: 0, status: "SURPLUS" },
  { id: 103, timestamp: "2025-11-30 10:00", hour: 10, wind: 5462, solar: 3600, total: 9062, forecast: 8900, demand: 7500, offset: 14203, partition: 0, status: "SURPLUS" },
  { id: 104, timestamp: "2025-11-30 11:00", hour: 11, wind: 6787, solar: 4200, total: 10987, forecast: 10500, demand: 8200, offset: 14204, partition: 1, status: "SURPLUS" },
  { id: 105, timestamp: "2025-11-30 12:00", hour: 12, wind: 7737, solar: 4500, total: 12237, forecast: 11900, demand: 8600, offset: 14205, partition: 1, status: "SURPLUS" },
  { id: 106, timestamp: "2025-11-30 13:00", hour: 13, wind: 7100, solar: 4350, total: 11450, forecast: 11200, demand: 8400, offset: 14206, partition: 1, status: "SURPLUS" },
  { id: 107, timestamp: "2025-11-30 14:00", hour: 14, wind: 6200, solar: 3800, total: 10000, forecast: 10100, demand: 8100, offset: 14207, partition: 0, status: "SURPLUS" },
  { id: 108, timestamp: "2025-11-30 15:00", hour: 15, wind: 5584, solar: 2700, total: 8284, forecast: 8400, demand: 7900, offset: 14208, partition: 0, status: "BALANCED" },
  { id: 109, timestamp: "2025-11-30 16:00", hour: 16, wind: 3824, solar: 1100, total: 4924, forecast: 5100, demand: 7600, offset: 14209, partition: 0, status: "DEFICIT" },
  { id: 110, timestamp: "2025-11-30 17:00", hour: 17, wind: 3539, solar: 180, total: 3719, forecast: 3900, demand: 7800, offset: 14210, partition: 1, status: "DEFICIT" },
  { id: 111, timestamp: "2025-11-30 18:00", hour: 18, wind: 3824, solar: 0, total: 3824, forecast: 3750, demand: 8300, offset: 14211, partition: 1, status: "DEFICIT" },
  { id: 112, timestamp: "2025-11-30 19:00", hour: 19, wind: 4186, solar: 0, total: 4186, forecast: 4200, demand: 8100, offset: 14212, partition: 0, status: "DEFICIT" },
  { id: 113, timestamp: "2025-11-30 20:00", hour: 20, wind: 4600, solar: 0, total: 4600, forecast: 4700, demand: 7200, offset: 14213, partition: 0, status: "DEFICIT" },
  { id: 114, timestamp: "2025-11-30 21:00", hour: 21, wind: 5281, solar: 0, total: 5281, forecast: 5150, demand: 6400, offset: 14214, partition: 1, status: "DEFICIT" },
  { id: 115, timestamp: "2025-11-30 22:00", hour: 22, wind: 5664, solar: 0, total: 5664, forecast: 5500, demand: 5600, offset: 14215, partition: 1, status: "BALANCED" }
];

export const pipelineNodes = [
  {
    id: "wokwi",
    name: "Wokwi Sensor Simulator",
    tech: "Arduino / ESP32 + MicroPython",
    status: "Active",
    metrics: "2 Nodes (Anemometer + Photovoltaic Pyranometer)",
    type: "source"
  },
  {
    id: "producer",
    name: "Python Kafka Producer",
    tech: "Python / kafka-python",
    status: "Publishing",
    metrics: "1 event / sec • JSON formatted",
    type: "bridge"
  },
  {
    id: "kafka_broker",
    name: "Apache Kafka Broker",
    tech: "Kafka 4.3.1 (KRaft Mode)",
    status: "Healthy",
    metrics: "localhost:9092 • Topic: renewable-energy",
    type: "broker"
  },
  {
    id: "stream_processor",
    name: "Stream Processor",
    tech: "Kafka Streams / Python Real-time Engine",
    status: "Transforming",
    metrics: "Validates schema • Calculates total & rolling metrics",
    type: "processor"
  },
  {
    id: "processed_topic",
    name: "Processed Topic",
    tech: "Kafka Topic",
    status: "Flowing",
    metrics: "Topic: renewable-energy-processed",
    type: "topic"
  },
  {
    id: "subscriber",
    name: "Python Subscriber & API",
    tech: "Python Consumer + FastAPI",
    status: "Consuming",
    metrics: "Group: renewable-subscriber • Offset ack",
    type: "consumer"
  },
  {
    id: "postgres",
    name: "PostgreSQL Database",
    tech: "PostgreSQL 16",
    status: "Synchronized",
    metrics: "DB: renewable_energy • Table: energy_readings",
    type: "storage"
  }
];

export const mlModelMeta = {
  modelType: "Gradient Boosted Regressor (XGBoost / LightGBM) + LSTM",
  target: "Total Generation (t+1 hour ahead)",
  r2Score: "0.942",
  mae: "142.8 kW",
  rmse: "198.5 kW",
  trainingDatasetRows: 51865,
  gpuEnvironment: "Kaggle T4 x2 GPU Accelerator",
  features: [
    "wind_t-1 (lagged generation)",
    "wind_t-2 (lagged generation)",
    "solar_t-1 (lagged generation)",
    "rolling_wind_3h",
    "rolling_solar_3h",
    "start_hour (sin/cos encoded)",
    "day_of_year",
    "month_name",
    "season_code"
  ]
};
