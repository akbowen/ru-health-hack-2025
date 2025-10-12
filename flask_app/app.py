from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import tempfile, os, uuid, shutil

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
