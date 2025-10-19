# ingestion.py (inside flask_app/)
import os
import time
from pathlib import Path
from dotenv import load_dotenv

import pandas as pd
from langchain_core.documents import Document

from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings

load_dotenv()

def _ensure_index(pc: Pinecone, index_name: str):
    existing_indexes = [idx["name"] for idx in pc.list_indexes()]
    if index_name not in existing_indexes:
        pc.create_index(
            name=index_name,
            dimension=3072,                # OpenAI text-embedding-3-large
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(index_name).status["ready"]:
            time.sleep(1)

def ingest_rank2(xlsx_path: str):
    """
    Read a scheduler output Excel (Rank #2) and index day-level semantic summaries into Pinecone.
    xlsx_path: absolute or relative path to the saved Excel.
    """
    # Resolve path relative to this file if a bare name is given
    xlsx_path = str(Path(xlsx_path))
    if not os.path.exists(xlsx_path):
        raise FileNotFoundError(f"ingestion: file not found: {xlsx_path}")

    # --- Pinecone + embeddings setup ---
    pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
    index_name = os.environ.get("PINECONE_INDEX_NAME")
    if not index_name:
        raise RuntimeError("PINECONE_INDEX_NAME is not set in environment.")

    _ensure_index(pc, index_name)
    index = pc.Index(index_name)

    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-large",
        api_key=os.environ.get("OPENAI_API_KEY"),
    )
    vector_store = PineconeVectorStore(index=index, embedding=embeddings)

    # --- Parse Excel (same logic you had, made robust) ---
    df0 = pd.read_excel(xlsx_path, header=None)

    meta = {
        "satisfaction_score": (
            float(str(df0.iloc[0,1]).replace("Satisfaction","").strip().split()[-1])
            if "Satisfaction" in str(df0.iloc[0,0]) else None
        ),
        "coverage": str(df0.iloc[1,1]),
        "uncovered": str(df0.iloc[2,1]),
        "providers_affected": str(df0.iloc[4,1]),
    }

    # Real header starts at row 6 => 0-based index 6
    df_schedule = pd.read_excel(xlsx_path, header=6)
    long_df = (
        df_schedule
        .melt(id_vars=["Day"], var_name="Slot", value_name="Provider")
        .dropna()
    )

    summaries = []
    for day, group in long_df.groupby("Day"):
        slots = "; ".join(f"{r.Slot}: {r.Provider}" for _, r in group.iterrows())
        text = (
            f"Day {day}: {slots}. "
            f"Satisfaction score={meta['satisfaction_score']}, "
            f"Coverage={meta['coverage']}, Providers affected={meta['providers_affected']}."
        )
        summaries.append(Document(page_content=text, metadata={"day": int(day)}))

    # Use file stem to keep IDs unique across multiple ingestions
    stem = Path(xlsx_path).stem.replace(" ", "_")
    ids = [f"{stem}-day-{i}" for i in range(len(summaries))]

    vector_store.add_documents(documents=summaries, ids=ids)
    print(f"[ingestion] Indexed {len(summaries)} day-summaries from {xlsx_path} into Pinecone.")

# Optional: allow running as a script for manual testing
if __name__ == "__main__":
    # default to the most recent Excel in documents/
    docs_dir = Path(__file__).with_name("documents")
    latest = sorted(docs_dir.glob("*.xlsx"))[-1] if list(docs_dir.glob("*.xlsx")) else None
    if not latest:
        raise SystemExit("No .xlsx found in documents/")
    ingest_rank2(str(latest))
