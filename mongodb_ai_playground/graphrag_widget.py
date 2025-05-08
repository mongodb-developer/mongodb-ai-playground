# graphrag_widget.py
# ------------------------------------------------
# Python: MongoDBGraphRAGPlayground
# Two‑step playground: 1) Ingest & Graph  2) Question Answering
# ------------------------------------------------
import pathlib, traitlets, anywidget, networkx as nx
from pyvis.network import Network
from langchain.text_splitter import (
    CharacterTextSplitter,
    RecursiveCharacterTextSplitter,
    MarkdownTextSplitter,
)
from langchain_mongodb.graphrag.graph import MongoDBGraphStore
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

current_directory = pathlib.Path().resolve()


def visualize_graph(collection):
    """Return a PyVis HTML of the graph stored in MongoDB."""
    docs = list(collection.find())

    def fmt(attrs):
        return "<br>".join(f"{k}: {', '.join(v)}" for k, v in attrs.items()) if attrs else ""

    G = nx.DiGraph()
    for d in docs:
        nid = str(d["_id"])
        info = f"Type: {d.get('type','')}"
        if "attributes" in d:
            extra = fmt(d["attributes"])
            if extra:
                info += "<br>" + extra
        G.add_node(nid, label=nid, title=info.replace("<br>", "\n"))

    for d in docs:
        src = str(d["_id"])
        rel = d.get("relationships", {})
        for i, tgt in enumerate(rel.get("target_ids", [])):
            etype = rel.get("types", [])[i] if i < len(rel.get("types", [])) else ""
            extra = rel.get("attributes", [])[i] if i < len(rel.get("attributes", [])) else {}
            lbl = fmt(extra)
            G.add_edge(src, str(tgt), label=etype, title=lbl.replace("<br>", "\n"))

    nt = Network(notebook=False, cdn_resources="in_line", height="600px", width="90%")
    nt.from_nx(G)
    return nt.generate_html()


class MongoDBGraphRAGPlayground(anywidget.AnyWidget):
    """AnyWidget UI for Graph‑based RAG on MongoDB Atlas."""

    _esm = pathlib.Path(__file__).parent / "graphrag.js"
    _css = pathlib.Path(__file__).parent / "index.css"

    # UI state
    current_step = traitlets.Int(1).tag(sync=True)  # 1=Ingest&Graph  2=QA
    split_strategy = traitlets.Unicode("Fixed").tag(sync=True)
    chunk_size = traitlets.Int(512).tag(sync=True)
    overlap_size = traitlets.Int(0).tag(sync=True)
    current_doc_index = traitlets.Int(0).tag(sync=True)

    # Preview & chunks
    document_preview = traitlets.Unicode("").tag(sync=True)
    chunks_table = traitlets.List(traitlets.Dict()).tag(sync=True)

    # Graph HTML (PyVis)
    graph_html = traitlets.Unicode("").tag(sync=True)

    # QA
    rag_query = traitlets.Unicode("").tag(sync=True)
    rag_answer = traitlets.Unicode("").tag(sync=True)

    # Prompt template (editable)
    rag_prompt_template = traitlets.Unicode("").tag(sync=True)

    # Command + error
    command = traitlets.Unicode("").tag(sync=True)
    error = traitlets.Unicode("").tag(sync=True)

    # ------------------------------------------------
    # Init
    # ------------------------------------------------
    def __init__(
        self,
        loader=None,
        mongo_collection=None,
        entity_extraction_model=None,
        llm=None,
        **kwargs,
    ):
        """
        loader: LangChain loader for docs
        mongo_collection: pymongo collection holding the graph
        entity_extraction_model: LLM used by MongoDBGraphStore for entity extraction
        llm: LLM used to answer final user question
        """
        super().__init__(**kwargs)
        self.loader = loader
        self.mongo_collection = mongo_collection
        self.entity_model = entity_extraction_model
        self.llm = llm

        # Load pages
        try:
            docs = self.loader.load() if self.loader else []
            self.loaded_pages = [d.page_content for d in docs]
        except Exception as e:
            self.loaded_pages, self.error = [], f"Loader error: {e}"

        # Default prompt
        self.rag_prompt_template = (
            "<context>\n{context}\n</context>\n<question>{question}</question>\n"
            "<instructions>Answer using only the CONTEXT facts. "
            "If insufficient, respond 'I don't know'.</instructions>"
        )

        # Build chunks + preview
        self._create_chunks_for_all_pages()
        self._update_preview()

    # ------------------------------------------------
    # Chunking helpers
    # ------------------------------------------------
    def _get_splitter(self, add_start_index=False):
        opts = dict(chunk_size=self.chunk_size, chunk_overlap=self.overlap_size, add_start_index=add_start_index)
        return (
            RecursiveCharacterTextSplitter(**opts)
            if self.split_strategy == "Recursive"
            else MarkdownTextSplitter(**opts)
            if self.split_strategy == "Markdown"
            else CharacterTextSplitter(separator="", **opts)
        )

    def _create_chunks_for_all_pages(self):
        self.chunks_table = []
        if not self.loaded_pages:
            return
        splitter = self._get_splitter(add_start_index=True)
        for p, page in enumerate(self.loaded_pages):
            for c, doc in enumerate(splitter.create_documents([page])):
                self.chunks_table.append(
                    {
                        "page_index": p,
                        "chunk_index": c,
                        "chunk_text": doc.page_content,
                        "start_offset": doc.metadata["start_index"],
                        "end_offset": doc.metadata["start_index"] + len(doc.page_content),
                    }
                )

    def _build_highlighted_html(self, text, infos):
        if not text:
            return ""
        cov = [[] for _ in range(len(text))]
        for info in infos:
            for i in range(info["start_offset"], min(info["end_offset"], len(text))):
                cov[i].append(info["chunk_index"])

        colors = ["rgba(227,252,247,.9)", "rgba(249,235,255,.9)", "rgba(0,210,255,.3)"]
        html = []
        span, last = text[0], cov[0]
        esc = lambda t: t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        style = lambda cover: (
            "" if not cover else f'style="background:{colors[cover[0]%len(colors)]}"'
            if len(cover) == 1
            else 'style="background:rgba(144,168,84,.5)"'
        )
        for i in range(1, len(text)):
            if cov[i] != last:
                html.append(f'<span {style(last)}>{esc(span)}</span>')
                span, last = text[i], cov[i]
            else:
                span += text[i]
        html.append(f'<span {style(last)}>{esc(span)}</span>')
        return "".join(html)

    def _update_preview(self):
        idx = self.current_doc_index
        if 0 <= idx < len(self.loaded_pages):
            text = self.loaded_pages[idx]
            info = [r for r in self.chunks_table if r["page_index"] == idx]
            self.document_preview = self._build_highlighted_html(text, info)
        else:
            self.document_preview = "No page."

    @traitlets.observe("current_doc_index")
    def _on_page(self, _):
        self._update_preview()

    @traitlets.observe("chunk_size", "overlap_size", "split_strategy")
    def _on_chunk_settings(self, _):
        self._create_chunks_for_all_pages()
        self._update_preview()

    # ------------------------------------------------
    # Commands
    # ------------------------------------------------
    @traitlets.observe("command")
    def _dispatch(self, change):
        cmd = change["new"]
        if cmd == "ingest_graph":
            self._ingest_graph()
        elif cmd == "graph_ask":
            self._answer_question()
        self.command = ""

    def _ingest_graph(self):
        if self.mongo_collection is None:
            self.error = "No MongoDB collection provided."
            return
        try:
            # 1. Clear existing docs
            self.mongo_collection.delete_many({})
            # 2. Build Document objects from chunks
            from langchain_core.documents import Document

            docs = [
                Document(page_content=row["chunk_text"], metadata={"page": row["page_index"]})
                for row in self.chunks_table
            ]
            # 3. Create & use graph store
            store = MongoDBGraphStore(
                collection=self.mongo_collection,          # ← just hand over the live collection
                entity_extraction_model=self.entity_model,
            )
            store.add_documents(docs)
            # 4. Visualize
            self.graph_html = visualize_graph(self.mongo_collection)
        except Exception as e:
            self.error = f"Graph ingest error: {e}"

    def _answer_question(self):
        q = self.rag_query.strip()
        if not q:
            self.error = "Empty question."
            return
        try:
            store = MongoDBGraphStore(
                collection=self.mongo_collection,          # ← same here
                entity_extraction_model=self.entity_model,
            )
            # Retrieve context via graph store
            docs = store.search(q, k=5)
            context = "\n\n".join(d.page_content for d in docs)
            prompt = ChatPromptTemplate.from_template(self.rag_prompt_template)
            final_prompt = prompt.format_prompt(context=context, question=q)
            chain = (
                {"context": (lambda _: context), "question": RunnablePassthrough()}
                | prompt
                | self.llm
                | StrOutputParser()
            )
            self.rag_answer = chain.invoke(q)
        except Exception as e:
            self.error = f"QA error: {e}"
