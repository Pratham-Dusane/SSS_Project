#!/usr/bin/env python3
"""
Renewable Grid - Online ML Energy Forecaster & Grid Balancing Engine
====================================================================
Loads the champion LightGBM regressor and model metadata.
Maintains a sliding window history of streaming readings to compute
dynamic time-series features (kinematic ramp velocity/acceleration,
rolling volatilities, solar celestial proxies, cyclical time encodings,
and multi-day lag memory) in real time (< 5ms inference latency).

Evaluates the Phase 7 Grid Balancing decision rule:
    Net Balance = Forecast (t+1) - Demand
    State: SURPLUS | BALANCED | DEFICIT
"""

import os
import sys
import json
import logging
from collections import deque
from datetime import datetime

import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger("ML-FORECASTER")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.path.join(BASE_DIR, "champion_model.joblib")
DEFAULT_META_PATH = os.path.join(BASE_DIR, "model_metadata.json")

class OnlineEnergyForecaster:
    def __init__(self, model_path=DEFAULT_MODEL_PATH, meta_path=DEFAULT_META_PATH):
        self.model_path = model_path
        self.meta_path = meta_path
        self.model = None
        self.metadata = {}
        self.feature_names = []
        # Rolling buffer storing recent hourly generation values for lag & rolling stats
        self.history = deque(maxlen=48)
        self.load_model()

    def load_model(self):
        """Loads champion model and feature metadata."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Champion model not found at: {self.model_path}")
        if not os.path.exists(self.meta_path):
            raise FileNotFoundError(f"Model metadata not found at: {self.meta_path}")

        try:
            with open(self.meta_path, "r") as f:
                self.metadata = json.load(f)
            self.feature_names = self.metadata.get("features", [])
            self.model = joblib.load(self.model_path)
            logger.info("Successfully loaded champion model '%s' with %d features", 
                        self.metadata.get("model_type", "LGBMRegressor"), len(self.feature_names))
        except Exception as e:
            logger.error("Failed to load ML model: %s", e)
            raise e

    def seed_history(self, values):
        """Seed rolling history buffer with recent production readings."""
        for v in values:
            try:
                self.history.appendleft(float(v))
            except (ValueError, TypeError):
                pass

    def extract_features(self, current_prod, timestamp_str):
        """
        Extracts 31 time-series, kinematic, and solar proxy features
        matching the exact training schema from model_metadata.json.
        """
        try:
            dt = datetime.strptime(str(timestamp_str), "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                dt = datetime.strptime(str(timestamp_str), "%Y-%m-%d %H:%M")
            except Exception:
                dt = datetime.now()

        hour = dt.hour
        month = dt.month
        y_t = float(current_prod)

        # 1. Autoregressive Lags
        l1 = self.history[0] if len(self.history) > 0 else y_t
        l2 = self.history[1] if len(self.history) > 1 else l1
        l3 = self.history[2] if len(self.history) > 2 else l2
        l24 = self.history[23] if len(self.history) > 23 else l1
        l48 = self.history[47] if len(self.history) > 47 else l24

        # 2. Kinematics (Ramp Rates & Acceleration)
        ramp_1h = y_t - l1
        accel_1h = ramp_1h - (l1 - l2)
        ramp_3h = (y_t - l3) / 3.0
        diurnal_diff = y_t - l24

        # 3. Multi-Scale Volatilities & Rolling Statistics
        series_3 = [y_t] + list(self.history)[:2]
        series_6 = [y_t] + list(self.history)[:5]
        series_12 = [y_t] + list(self.history)[:11]
        series_24 = [y_t] + list(self.history)[:23]

        roll_mean_3h = float(np.mean(series_3))
        roll_std_3h = float(np.std(series_3))
        roll_mean_6h = float(np.mean(series_6))
        roll_std_6h = float(np.std(series_6))
        roll_mean_12h = float(np.mean(series_12))
        roll_std_12h = float(np.std(series_12))
        roll_mean_24h = float(np.mean(series_24))
        roll_std_24h = float(np.std(series_24))

        volatility_ratio_3_24 = roll_std_3h / (roll_std_24h + 1e-5)
        z_score_24h = (y_t - roll_mean_24h) / (roll_std_24h + 1e-5)

        # 4. Exponential Smoothing (EWMA)
        ewma_3h = (y_t * 0.5) + (roll_mean_3h * 0.5)
        ewma_12h = (y_t * 0.15) + (roll_mean_12h * 0.85)

        # 5. Solar Celestial Geometry Proxies
        dist_from_solar_noon = abs(hour - 12.5)
        solar_elevation_proxy = max(0.0, float(np.cos(np.pi * (hour - 12.5) / 12.0)))
        is_daylight = 1 if (7 <= hour <= 20) else 0
        is_solar_ramp_up = 1 if (7 <= hour <= 12) else 0
        is_solar_ramp_down = 1 if (13 <= hour <= 19) else 0

        # 6. Cyclical Trigonometric Time Encodings
        hour_sin = float(np.sin(2 * np.pi * hour / 24.0))
        hour_cos = float(np.cos(2 * np.pi * hour / 24.0))
        month_sin = float(np.sin(2 * np.pi * month / 12.0))
        month_cos = float(np.cos(2 * np.pi * month / 12.0))

        feat_dict = {
            "Production": y_t,
            "ramp_1h": ramp_1h,
            "accel_1h": accel_1h,
            "ramp_3h": ramp_3h,
            "diurnal_diff": diurnal_diff,
            "roll_mean_3h": roll_mean_3h,
            "roll_std_3h": roll_std_3h,
            "roll_mean_6h": roll_mean_6h,
            "roll_std_6h": roll_std_6h,
            "roll_mean_12h": roll_mean_12h,
            "roll_std_12h": roll_std_12h,
            "roll_mean_24h": roll_mean_24h,
            "roll_std_24h": roll_std_24h,
            "volatility_ratio_3_24": volatility_ratio_3_24,
            "z_score_24h": z_score_24h,
            "ewma_3h": ewma_3h,
            "ewma_12h": ewma_12h,
            "dist_from_solar_noon": dist_from_solar_noon,
            "solar_elevation_proxy": solar_elevation_proxy,
            "is_daylight": is_daylight,
            "is_solar_ramp_up": is_solar_ramp_up,
            "is_solar_ramp_down": is_solar_ramp_down,
            "lag_1h": l1,
            "lag_2h": l2,
            "lag_3h": l3,
            "lag_24h": l24,
            "lag_48h": l48,
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
            "month_sin": month_sin,
            "month_cos": month_cos
        }

        return feat_dict

    def predict_stream(self, current_prod, timestamp_str, demand=7500.0, threshold=300.0):
        """
        Executes online prediction and grid balancing evaluation.
        Updates the internal rolling history buffer upon completion.
        """
        feat_dict = self.extract_features(current_prod, timestamp_str)
        X_df = pd.DataFrame([feat_dict])[self.feature_names]

        # LightGBM Regressor forecast
        raw_pred = float(self.model.predict(X_df)[0])
        # Physics constraint: power generation cannot be negative
        forecast_mw = max(0.0, round(raw_pred, 1))

        # Push current reading to rolling memory buffer
        self.history.appendleft(float(current_prod))

        # Grid balancing calculation (PRD Section 16)
        net_balance = round(forecast_mw - demand, 1)
        if net_balance > threshold:
            decision = "SURPLUS"
            action = "Charge BESS storage array & signal renewable curtailment"
        elif net_balance < -threshold:
            decision = "DEFICIT"
            action = "Discharge BESS storage & signal spinning reserve peakers"
        else:
            decision = "BALANCED"
            action = "Grid frequency synchronized within ±tolerance band"

        simulated_freq = round(50.0 + (net_balance / 25000.0), 2)

        return {
            "forecast_t1_mw": forecast_mw,
            "demand_mw": round(demand, 1),
            "net_balance_mw": net_balance,
            "decision": decision,
            "action": action,
            "frequency_hz": simulated_freq,
            "model_type": self.metadata.get("model_type", "LightGBMRegressor")
        }
