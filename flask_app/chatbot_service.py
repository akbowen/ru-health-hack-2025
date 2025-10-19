# flask_app/chatbot_service.py
import os
import threading
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.messages import SystemMessage, HumanMessage

load_dotenv()

# ---------- Lazy singletons (thread-safe) ----------
_init_lock = threading.Lock()
_STATE: Dict[str, Any] = {
    "pc": None,
    "index": None,
    "emb": None,
    "vs": None,
    "retriever": None,
    "llm": None,
}

def _ensure_ready():
    if _STATE["retriever"] and _STATE["llm"]:
        return
    with _init_lock:
        if _STATE["retriever"] and _STATE["llm"]:
            return

        pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
        index_name = os.environ.get("PINECONE_INDEX_NAME")
        if not index_name:
            raise RuntimeError("PINECONE_INDEX_NAME is not set")

        index = pc.Index(index_name)

        emb = OpenAIEmbeddings(
            model=os.environ.get("EMBED_MODEL", "text-embedding-3-large"),
            api_key=os.environ.get("OPENAI_API_KEY"),
        )
        vs = PineconeVectorStore(index=index, embedding=emb)

        retriever = vs.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={"k": 6, "score_threshold": 0.4},
        )

        llm = ChatOpenAI(
            model=os.environ.get("CHAT_MODEL", "gpt-4o-mini"),
            temperature=0.2,
            api_key=os.environ.get("OPENAI_API_KEY"),
        )

        _STATE.update(pc=pc, index=index, emb=emb, vs=vs, retriever=retriever, llm=llm)

def _make_system_prompt(username: Optional[str]) -> str:
    who = username or "the user"
    return (
        "You are RU-Health Schedule Assistant.\n"
        "Answer only using the retrieved schedule context. If the answer is not in the context, say you don’t know.\n"
        "Prefer concise, direct answers (<=5 sentences). If dates are asked, be explicit about the day names.\n"
        f"User: {who}.\n"
        "If you summarize shifts, show day → slots succinctly. Avoid hallucinating sites or providers."
    )

def _format_context(docs: List[Document]) -> str:
    # Cap context length to keep prompts small
    parts, total = [], 0
    for i, d in enumerate(docs, 1):
        chunk = d.page_content.strip()
        meta = d.metadata or {}
        tag = ", ".join(f"{k}={v}" for k, v in meta.items()) if meta else ""
        snippet = f"[DOC {i}{' | ' + tag if tag else ''}]\n{chunk}\n"
        parts.append(snippet)
        total += len(chunk)
        if total > 8000:  # soft guard
            break
    return "\n".join(parts)

def _extract_sources(docs: List[Document]) -> List[Dict[str, Any]]:
    out = []
    for d in docs:
        meta = d.metadata or {}
        out.append({
            "metadata": meta,
            "preview": d.page_content[:200] + ("..." if len(d.page_content) > 200 else "")
        })
    return out

def answer_question(question: str, username: Optional[str] = None) -> Dict[str, Any]:
    _ensure_ready()
    retriever = _STATE["retriever"]
    llm = _STATE["llm"]

    docs = retriever.invoke(question) or []
    context = _format_context(docs)

    sys = _make_system_prompt(username)
    # Pack context + question into a single user turn so LLM has both
    user = (
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        "If counts are needed, compute from the context. If uncertain, say you don’t know."
    )

    msg = [SystemMessage(sys), HumanMessage(user)]
    reply = llm.invoke(msg).content

    return {
        "answer": reply,
        "sources": _extract_sources(docs)
    }
