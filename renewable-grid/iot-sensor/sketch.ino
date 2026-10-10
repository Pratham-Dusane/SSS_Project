/*
  ========================================================================
  Renewable Energy Grid - ESP32 IoT Sensor Telemetry Node (Wokwi)
  ========================================================================
  Sensors:
    - Photoresistor (LDR) on GPIO 34 -> Simulates Solar Irradiance / Power (MW)
    - Potentiometer on GPIO 35       -> Simulates Wind Turbine Speed / Power (MW)
    - DHT22 on GPIO 4                -> Simulates Ambient Temp (°C) & Humidity (%)
    - SSD1306 OLED (I2C)             -> Real-time telemetry & connection HUD
    - Status LED on GPIO 2           -> Telemetry heartbeat / activity indicator

  Connectivity:
    - WiFi: Wokwi-GUEST (Simulated high-speed connection)
    - MQTT: Public broker broker.hivemq.com (port 1883)
    - Topic: renewable-grid/iot/sensors
  ========================================================================
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include "time.h"

// ---------------------- PIN DEFINITIONS ----------------------
#define PIN_SOLAR_LDR    34   // Analog Input for Solar Irradiance
#define PIN_WIND_POT     35   // Analog Input for Wind Turbine Speed
#define PIN_DHT          4    // Digital Data pin for DHT22
#define PIN_STATUS_LED   2    // Built-in / Status LED
#define DHT_TYPE         DHT22

// ---------------------- OLED DISPLAY CONFIG ------------------
#define SCREEN_WIDTH     128
#define SCREEN_HEIGHT    64
#define OLED_RESET       -1
#define SCREEN_ADDRESS   0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool hasDisplay = false;

// ---------------------- SENSOR OBJECTS -----------------------
DHT dht(PIN_DHT, DHT_TYPE);

// ---------------------- NETWORK & MQTT CONFIG ----------------
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// Public MQTT Broker for Wokwi internet simulation
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "renewable-grid/iot/sensors";
const char* DEVICE_ID     = "esp32-renewable-station-01";

// NTP Server for real timestamps
const char* NTP_SERVER    = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 19800;  // IST (+5:30)
const int   DAYLIGHT_OFFSET = 0;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastPublishTime = 0;
const unsigned long PUBLISH_INTERVAL = 2000; // Publish every 2 seconds
unsigned long messageSeq = 0;

// ---------------------- HELPER FUNCTIONS ---------------------
void initDisplay() {
  Wire.begin(21, 22);
  if (display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    hasDisplay = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println(F("RENEWABLE IOT"));
    display.println(F("Initializing..."));
    display.display();
  } else {
    Serial.println(F("[WARN] SSD1306 OLED not detected. Running headless."));
  }
}

void updateOLED(float solarMW, float windMW, float totalMW, float temp, bool mqttOk) {
  if (!hasDisplay) return;

  display.clearDisplay();
  
  // Header banner
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(F("IOT STATION #01 "));
  display.println(mqttOk ? F("[MQTT OK]") : F("[MQTT ERR]"));
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // Solar reading
  display.setCursor(0, 14);
  display.print(F("SOLAR : "));
  display.print(solarMW, 1);
  display.println(F(" MW"));

  // Wind reading
  display.setCursor(0, 26);
  display.print(F("WIND  : "));
  display.print(windMW, 1);
  display.println(F(" MW"));

  // Total generation
  display.setCursor(0, 38);
  display.print(F("TOTAL : "));
  display.print(totalMW, 1);
  display.println(F(" MW"));

  // Environment & packet count
  display.setCursor(0, 50);
  display.print(F("T:"));
  display.print(temp, 1);
  display.print(F("C  Seq:#"));
  display.print(messageSeq);

  display.display();
}

void connectWiFi() {
  Serial.print(F("[WIFI] Connecting to "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[WIFI] Connected successfully!"));
    Serial.print(F("[WIFI] IP Address: "));
    Serial.println(WiFi.localIP());
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET, NTP_SERVER);
  } else {
    Serial.println(F("\n[WIFI] Connection failed. Retrying..."));
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print(F("[MQTT] Connecting to broker: "));
    Serial.println(MQTT_BROKER);

    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(F("[MQTT] Connected to broker successfully!"));
      digitalWrite(PIN_STATUS_LED, HIGH);
    } else {
      Serial.print(F("[MQTT] Connection failed, rc="));
      Serial.print(mqttClient.state());
      Serial.println(F(". Retrying in 2 seconds..."));
      digitalWrite(PIN_STATUS_LED, LOW);
      delay(2000);
    }
  }
}

String getFormattedTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    // Fallback timestamp if NTP not yet synced
    unsigned long secs = millis() / 1000;
    char buf[32];
    snprintf(buf, sizeof(buf), "2026-10-10 12:%02lu:%02lu", (secs / 60) % 60, secs % 60);
    return String(buf);
  }
  char timeStringBuff[32];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

// ---------------------- SETUP & LOOP -------------------------
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println(F("\n=================================================="));
  Serial.println(F("Renewable Energy IoT Node - Booting up..."));
  Serial.println(F("=================================================="));

  pinMode(PIN_SOLAR_LDR, INPUT);
  pinMode(PIN_WIND_POT, INPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  initDisplay();
  dht.begin();

  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - lastPublishTime >= PUBLISH_INTERVAL) {
    lastPublishTime = currentMillis;

    // 1. Read Analog Sensors
    // In Wokwi, Photoresistor gives 0 (bright) to 4095 (dark) or vice versa depending on module.
    // We calibrate so higher brightness produces higher Solar MW (0 to 500 MW scale).
    int rawSolar = analogRead(PIN_SOLAR_LDR);
    float solarMW = (float)rawSolar / 4095.0f * 500.0f;
    solarMW = round(solarMW * 10.0f) / 10.0f;

    // Wind Potentiometer simulates turbine generator output (0 to 650 MW scale)
    int rawWind = analogRead(PIN_WIND_POT);
    float windMW = (float)rawWind / 4095.0f * 650.0f;
    windMW = round(windMW * 10.0f) / 10.0f;

    // Total Generation
    float totalMW = solarMW + windMW;

    // 2. Read DHT22 Environment
    float temp = dht.readTemperature();
    float humidity = dht.readHumidity();
    if (isnan(temp)) temp = 25.0f;
    if (isnan(humidity)) humidity = 50.0f;

    // 3. Format JSON Payload
    StaticJsonDocument<384> doc;
    messageSeq++;
    
    doc["device_id"]        = DEVICE_ID;
    doc["sequence"]         = messageSeq;
    doc["timestamp"]        = getFormattedTimestamp();
    doc["source"]           = "Wokwi-IoT-ESP32";
    doc["solar_production"] = solarMW;
    doc["wind_production"]  = windMW;
    doc["production"]       = totalMW;
    doc["temperature"]      = round(temp * 10.0f) / 10.0f;
    doc["humidity"]         = round(humidity * 10.0f) / 10.0f;
    doc["solar_raw"]        = rawSolar;
    doc["wind_raw"]         = rawWind;
    doc["unit"]             = "MW";

    char jsonBuffer[384];
    serializeJson(doc, jsonBuffer);

    // 4. Publish to MQTT
    digitalWrite(PIN_STATUS_LED, HIGH);
    bool pubSuccess = mqttClient.publish(MQTT_TOPIC, jsonBuffer);
    delay(50);
    digitalWrite(PIN_STATUS_LED, LOW);

    if (pubSuccess) {
      Serial.printf("[IOT-NODE] #%lu Sent | Solar: %.1f MW | Wind: %.1f MW | Total: %.1f MW | Temp: %.1f C\n",
                    messageSeq, solarMW, windMW, totalMW, temp);
    } else {
      Serial.println(F("[IOT-NODE] Error: Failed to publish MQTT message"));
    }

    // 5. Update OLED HUD
    updateOLED(solarMW, windMW, totalMW, temp, pubSuccess);
  }
}
