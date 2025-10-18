from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import tempfile, os, uuid, shutil
import pandas as pd
import numpy as np
import requests
from io import StringIO
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import traceback
from flask import Flask, jsonify, request

# Import your modules (they must be importable on PYTHONPATH or same folder)
import provider_analysis
import scheduler_cpsat_phase

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200MB
BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

REQUIRED_FIELDS = [
    "providerAvailability",
    "providerContract",
    "providerCredentialing",
    "facilityVolume",
    "facilityCoverage",
]


# ===========================
# CONFIG
# ===========================
METRICS = [
    "percent icu beds occupied",
    "percent icu beds occupied by covid-19 patients",
    "percent icu beds occupied by influenza patients",
    "percent icu beds occupied by rsv patients"
]

# ===========================
# HELPER: JSON SERIALIZATION
# ===========================
def make_json_serializable(obj):
    """Convert numpy/pandas types to Python native types for JSON"""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: make_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    elif pd.isna(obj):
        return None
    else:
        return obj


# ===========================
# HELPER FUNCTIONS
# ===========================
def get_state_data_csv(state: str) -> pd.DataFrame:
    """Fetch CDC hospital data for a specific state"""
    url = "https://data.cdc.gov/api/views/ua7e-t2fy/rows.csv?accessType=DOWNLOAD"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    
    df = pd.read_csv(StringIO(resp.text))
    df.columns = df.columns.str.strip().str.lower()
    df = df[df["geographic aggregation"].str.lower() == state.lower()]
    df["week ending date"] = pd.to_datetime(df["week ending date"], errors="coerce")
    df = df.sort_values("week ending date").reset_index(drop=True)
    return df

def clean_time_series(series):
    """Clean time series data by removing NaN, inf, and invalid values"""
    # Replace inf with NaN
    series = series.replace([np.inf, -np.inf], np.nan)
    
    # Forward fill NaN values
    series = series.fillna(method='ffill')
    
    # Backward fill any remaining NaN values
    series = series.fillna(method='bfill')
    
    # If still has NaN, fill with 0
    series = series.fillna(0)
    
    return series



# def calculate_forecast(state: str, predict_weeks: int = 1):
#     """Calculate forecast for ICU metrics with proper JSON serialization"""
#     try:
#         # Get data
#         df = get_state_data_csv(state)
        
#         if df.empty:
#             raise ValueError(f"No data found for state: {state}")
        
#         # Get last 12 weeks of historical data
#         historical_weeks = 12
#         historical_df = df.tail(historical_weeks).copy()
        
#         # Prepare historical data for each metric
#         historical_data = {}
#         for metric in METRICS:
#             historical_data[metric] = []
#             for _, row in historical_df.iterrows():
#                 value = row[metric]
#                 # Handle NaN values
#                 if pd.notna(value):
#                     historical_data[metric].append({
#                         "date": row["week ending date"].strftime("%Y-%m-%d"),
#                         "value": round(float(value), 2)
#                     })
        
#         # Get latest actual values
#         latest_data = {}
#         for metric in METRICS:
#             val = df[metric].iloc[-1]
#             latest_data[metric] = round(float(val), 2) if pd.notna(val) else 0.0
        
#         latest_date = df["week ending date"].iloc[-1]
        
#         # Calculate % change
#         data = df[METRICS].ffill()
#         pct_change_data = data.pct_change().dropna()
        
#         if pct_change_data.empty:
#             raise ValueError("Not enough data to compute weekly % change")
        
#         # Forecast
#         forecast_results = {}
#         predicted_values = {}
#         forecast_data = {}
        
#         for metric in METRICS:
#             ts = pct_change_data[metric]
#             if len(ts) < 2:
#                 continue
                
#             try:
#                 model = ExponentialSmoothing(ts, trend="add", seasonal=None)
#                 fit = model.fit(optimized=True)
#                 forecast = fit.forecast(predict_weeks)
                
#                 # Get percentage change
#                 pct_change = float(forecast.values[0]) * 100
#                 forecast_results[metric] = round(pct_change, 2)
                
#                 # Calculate predicted value
#                 current_value = latest_data.get(metric, 0)
#                 predicted_value = current_value * (1 + float(forecast.values[0]))
#                 predicted_values[metric] = round(predicted_value, 2)
                
#                 # Create forecast points
#                 forecast_points = []
#                 last_value = current_value
#                 for i in range(predict_weeks):
#                     future_date = latest_date + pd.Timedelta(days=7 * (i + 1))
#                     last_value = last_value * (1 + float(forecast.values[i]))
#                     forecast_points.append({
#                         "date": future_date.strftime("%Y-%m-%d"),
#                         "value": round(float(last_value), 2),
#                         "isForecast": True
#                     })
                
#                 forecast_data[metric] = forecast_points
                
#             except Exception as e:
#                 print(f"Error forecasting {metric}: {str(e)}")
#                 continue
        
#         # Return clean data
#         return {
#             "current_values": latest_data,
#             "predicted_changes": forecast_results,
#             "predicted_values": predicted_values,
#             "historical_data": historical_data,
#             "forecast_data": forecast_data,
#             "latest_date": latest_date.strftime("%Y-%m-%d")
#         }
    
#     except Exception as e:
#         print(f"Error in calculate_forecast: {traceback.format_exc()}")
#         raise



def calculate_forecast(state: str, predict_weeks: int = 1):
    """Calculate forecast for ICU metrics with proper JSON serialization"""
    try:
        # Get data
        df = get_state_data_csv(state)
        
        if df.empty:
            raise ValueError(f"No data found for state: {state}")
        
        # Check if we have enough data
        if len(df) < 2:
            raise ValueError(f"Not enough historical data for state: {state}")
        
        # Get last 12 weeks of historical data
        historical_weeks = min(12, len(df))
        historical_df = df.tail(historical_weeks).copy()
        
        # Prepare historical data for each metric
        historical_data = {}
        for metric in METRICS:
            historical_data[metric] = []
            if metric not in df.columns:
                continue
                
            for _, row in historical_df.iterrows():
                value = row[metric]
                if pd.notna(value) and not np.isinf(value):
                    historical_data[metric].append({
                        "date": row["week ending date"].strftime("%Y-%m-%d"),
                        "value": round(float(value), 2)
                    })
        
        # Get latest actual values
        latest_data = {}
        for metric in METRICS:
            if metric not in df.columns:
                latest_data[metric] = 0.0
                continue
            val = df[metric].iloc[-1]
            latest_data[metric] = round(float(val), 2) if pd.notna(val) and not np.isinf(val) else 0.0
        
        latest_date = df["week ending date"].iloc[-1]
        
        # Calculate % change
        data = df[METRICS].copy()
        
        # Clean each column
        for metric in METRICS:
            if metric in data.columns:
                data[metric] = clean_time_series(data[metric])
        
        pct_change_data = data.pct_change().dropna()
        
        # Clean pct_change_data
        for metric in METRICS:
            if metric in pct_change_data.columns:
                pct_change_data[metric] = clean_time_series(pct_change_data[metric])
        
        if pct_change_data.empty or len(pct_change_data) < 2:
            raise ValueError("Not enough data to compute weekly % change")
        
        # Forecast
        forecast_results = {}
        predicted_values = {}
        forecast_data = {}
        
        for metric in METRICS:
            if metric not in pct_change_data.columns:
                continue
                
            ts = pct_change_data[metric]
            
            # Check if time series has valid data
            if len(ts) < 2 or ts.isna().all():
                print(f"Skipping {metric}: insufficient data")
                continue
            
            # Check for zero variance
            if ts.std() == 0:
                print(f"Skipping {metric}: zero variance")
                continue
                
            try:
                # Fit exponential smoothing model
                model = ExponentialSmoothing(
                    ts, 
                    trend="add", 
                    seasonal=None,
                    initialization_method="estimated"
                )
                fit = model.fit(optimized=True, remove_bias=False)
                forecast = fit.forecast(predict_weeks)
                
                # Clean forecast values
                forecast = np.nan_to_num(forecast, nan=0.0, posinf=0.0, neginf=0.0)
                
                # Get percentage change
                pct_change = float(forecast[0]) * 100
                forecast_results[metric] = round(pct_change, 2)
                
                # Calculate predicted value
                current_value = latest_data.get(metric, 0)
                predicted_value = current_value * (1 + float(forecast[0]))
                predicted_values[metric] = round(predicted_value, 2)
                
                # Create forecast points
                forecast_points = []
                last_value = current_value
                for i in range(predict_weeks):
                    future_date = latest_date + pd.Timedelta(days=7 * (i + 1))
                    change = float(forecast[i]) if i < len(forecast) else 0
                    last_value = last_value * (1 + change)
                    forecast_points.append({
                        "date": future_date.strftime("%Y-%m-%d"),
                        "value": round(float(last_value), 2),
                        "isForecast": True
                    })
                
                forecast_data[metric] = forecast_points
                
            except Exception as e:
                print(f"Error forecasting {metric}: {str(e)}")
                continue
        
        # Return clean data
        return {
            "current_values": latest_data,
            "predicted_changes": forecast_results,
            "predicted_values": predicted_values,
            "historical_data": historical_data,
            "forecast_data": forecast_data,
            "latest_date": latest_date.strftime("%Y-%m-%d")
        }
    
    except Exception as e:
        print(f"Error in calculate_forecast: {traceback.format_exc()}")
        raise

# ===========================
# API ROUTES
# ===========================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "ICU Forecast Service"
    })

@app.route('/api/forecast/<state>', methods=['GET'])
def get_forecast(state):
    """
    Get ICU forecast for a specific state
    
    Parameters:
    - state: Two-letter state code (e.g., NJ, NY, CA)
    - weeks: Number of weeks to forecast (default: 1)
    
    Example: /api/forecast/NJ?weeks=1
    """
    try:
        weeks = request.args.get('weeks', 1, type=int)
        
        if weeks < 1 or weeks > 4:
            return jsonify({
                "error": "Weeks must be between 1 and 4"
            }), 400
        
        # Calculate forecast
        result = calculate_forecast(state.upper(), weeks)
        
        # Ensure everything is JSON serializable
        clean_result = make_json_serializable(result)
        
        # Build response
        response_data = {
            "success": True,
            "state": state.upper(),
            "weeks_ahead": weeks,
            "data": clean_result,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        
        print(f"✅ Returning forecast for {state.upper()}")
        
        return jsonify(response_data), 200
        
    except ValueError as e:
        error_response = {
            "success": False,
            "error": str(e)
        }
        print(f"❌ ValueError: {str(e)}")
        return jsonify(error_response), 404
        
    except Exception as e:
        print(f"❌ Error: {traceback.format_exc()}")
        error_response = {
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }
        return jsonify(error_response), 500

@app.route('/api/states', methods=['GET'])
def get_available_states():
    """Get list of available states"""
    # Common state codes - you can expand this
    states = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    ]
    
    return jsonify({
        "success": True,
        "states": states
    })


def save_payload_files(req):
    if not req.files:
        raise ValueError("Send multipart/form-data with 5 .xlsx files.")
    request_id = uuid.uuid4().hex
    workdir = os.path.join(DATA_DIR, request_id)
    os.makedirs(workdir, exist_ok=True)
    saved = {}
    try:
        for field in REQUIRED_FIELDS:
            fs = req.files.get(field)
            if not fs or not fs.filename:
                raise ValueError(f"Missing file for '{field}'.")
            # basic extension check (optional)
            if not fs.filename.lower().endswith(".xlsx"):
                raise ValueError(f"'{field}' must be a .xlsx file.")
            fname = secure_filename(fs.filename) or f"{field}.xlsx"
            path = os.path.join(workdir, fname)
            fs.save(path)
            saved[field] = path
        return workdir, saved
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

@app.route("/")
def home():
    return "<h1>Flask server is up</h1>"

# -------- Endpoint 1: Provider Analysis (direct import call) --------
@app.route("/api/run/provider-analysis", methods=["POST"])
def api_provider_analysis():
    try:
        workdir, files = save_payload_files(request)
        print("workdir path:", workdir)
        print("files:", files)
        try:
            result = provider_analysis.run_provider_analysis(
                availability_path    = files["providerAvailability"],
                contract_path        = files["providerContract"],
                credentialing_path   = files["providerCredentialing"],
                facility_volume_path = files["facilityVolume"],
                coverage_path        = files["facilityCoverage"],
                output_dir="output"
            )

            # --- NEW SECTION: Return ranked Excel file (Rank 2) ---
            rank2_path = result.get("rank2_path")
            if not rank2_path or not os.path.exists(rank2_path):
                return jsonify({
                    "status": "error",
                    "error": "Rank #2 provider analysis Excel not found",
                    "details": result
                }), 500

            return send_file(
                rank2_path,
                as_attachment=True,
                download_name=os.path.basename(rank2_path),
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    except ValueError as ve:
        return jsonify({"status": "error", "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500



# -------- Endpoint 2: Scheduler (direct import call) --------
@app.route("/api/run/scheduler", methods=["POST"])
def run_scheduler():
    try:
        workdir, files = save_payload_files(request)
        try:
            result = scheduler_cpsat_phase.run_scheduler_with_files(
                availability_path    = files["providerAvailability"],
                contract_path        = files["providerContract"],
                credentialing_path   = files["providerCredentialing"],
                facility_volume_path = files["facilityVolume"],
                coverage_path        = files["facilityCoverage"],
            )

            rank2_path = result.get("rank2_path")
            if not rank2_path or not os.path.exists(rank2_path):
                return jsonify({
                    "status": "error",
                    "error": "Rank #2 schedule not found",
                    "details": result
                }), 500

            return send_file(
                rank2_path,
                as_attachment=True,
                download_name=os.path.basename(rank2_path),
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

        finally:
            shutil.rmtree(workdir, ignore_errors=True)
    except ValueError as ve:
        return jsonify({"status": "error", "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


if __name__ == "__main__":
    # from flask_cors import CORS; CORS(app)  # enable if calling from a browser app
    app.run(host="0.0.0.0", port=5051, debug=True)
