import pandas as pd
import requests
from io import StringIO
from statsmodels.tsa.holtwinters import ExponentialSmoothing

# ===========================
# CONFIG
# ===========================
STATE = "NJ"
PREDICT_WEEKS = 1
METRICS = [
    "percent icu beds occupied",
    "percent icu beds occupied by covid-19 patients",
    "percent icu beds occupied by influenza patients",
    "percent icu beds occupied by rsv patients"
]

# ===========================
# FETCH CSV DATA
# ===========================
def get_state_data_csv(state: str) -> pd.DataFrame:
    url = "https://data.cdc.gov/api/views/ua7e-t2fy/rows.csv?accessType=DOWNLOAD"
    resp = requests.get(url)
    resp.raise_for_status()

    df = pd.read_csv(StringIO(resp.text))
    df.columns = df.columns.str.strip().str.lower()
    df = df[df["geographic aggregation"].str.lower() == state.lower()]
    df["week ending date"] = pd.to_datetime(df["week ending date"], errors="coerce")
    df = df.sort_values("week ending date").reset_index(drop=True)
    return df

# ===========================
# GET DATA
# ===========================
df = get_state_data_csv(STATE)
data = df[METRICS].ffill()

# ===========================
# COMPUTE WEEKLY % CHANGE
# ===========================
pct_change_data = data.pct_change().dropna()
if pct_change_data.empty:
    raise ValueError("Not enough data to compute weekly % change. Need at least 2 rows per metric.")

# ===========================
# FORECAST % CHANGE WITH EXPONENTIAL SMOOTHING
# ===========================
forecast_results = {}
for metric in METRICS:
    ts = pct_change_data[metric]
    if len(ts) < 2:
        print(f"Not enough data to forecast {metric}. Skipping.")
        continue
    model = ExponentialSmoothing(ts, trend="add", seasonal=None)
    fit = model.fit(optimized=True)
    forecast = fit.forecast(PREDICT_WEEKS)
    forecast_results[metric] = forecast.values[0] * 100  # convert to percentage

# ===========================
# PRINT PREDICTED % CHANGE
# ===========================
print("Predicted % change for next week:")
for metric, change in forecast_results.items():
    print(f"{metric}: {change:.2f}%")
