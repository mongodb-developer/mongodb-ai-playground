# ------------------------------------------------
# Python: MongoDBRAGPlayground (further updated)
# ------------------------------------------------
import pathlib
import anywidget
import traitlets
from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter, MarkdownTextSplitter
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

current_directory = pathlib.Path().resolve()

class MongoDBRAGPlayground(anywidget.AnyWidget):
    _esm = str(pathlib.Path(__file__).parent / "index.js")
    _css = str(pathlib.Path(__file__).parent / "index.css")

    # Which step is selected in the UI (1=Chunking, 2=Embedding, 3=RAG)
    current_step = traitlets.Int(1).tag(sync=True)

    # Chunking controls
    split_strategy = traitlets.Unicode("Fixed").tag(sync=True)
    chunk_size = traitlets.Int(512).tag(sync=True)
    overlap_size = traitlets.Int(0).tag(sync=True)
    current_doc_index = traitlets.Int(0).tag(sync=True)
    document_preview = traitlets.Unicode("").tag(sync=True)
    chunks_table = traitlets.List(traitlets.Dict()).tag(sync=True)

    # Step 2 controls
    selected_index = traitlets.Unicode("").tag(sync=True)
    embeddings_table = traitlets.List(traitlets.Dict()).tag(sync=True)
    mongo_docs_table = traitlets.List(traitlets.Dict()).tag(sync=True)
    embedding_ready = traitlets.Bool(False).tag(sync=True)
    loaded_in_mongo = traitlets.Bool(False).tag(sync=True)
    vector_indexes = traitlets.List(traitlets.Unicode()).tag(sync=True)

    # RAG controls
    rag_query = traitlets.Unicode("").tag(sync=True)    # The user's question
    rag_results = traitlets.List(traitlets.Dict()).tag(sync=True)  # RAG search results (docs & scores)
    rag_prompt = traitlets.Unicode("").tag(sync=True)   # The final expanded prompt actually sent to LLM
    rag_answer = traitlets.Unicode("").tag(sync=True)   # Final generated answer

    # NEW: The user-editable template
    rag_prompt_template = traitlets.Unicode("").tag(sync=True)

    # Command and error
    command = traitlets.Unicode("").tag(sync=True)
    error = traitlets.Unicode("").tag(sync=True)

    def set_error(self, message):
        """Set an error message and ensure it's sent to the frontend"""
        if message:
            self.error = message
            # Send via both mechanisms to ensure it's displayed
            self.send({"type": "update_error", "error": message})
            print(f"Error: {message}")  # Also log to console for debugging

    def clear_error(self):
        """Clear any error messages"""
        self.error = ""
        self.send({"type": "update_error", "error": ""})
        
    def test_error(self, message="This is a test error message"):
        """Function to test the error display system"""
        self.set_error(message)

    def __init__(self, loader=None, embedding_model=None, llm=None,
        mongo_collection=None, index_name=None, **kwargs):
        """
        loader: optional doc loader
        embedding_model: embedding model for vectorstore
        llm: language model for generating final RAG answer
        mongo_collection: pymongo collection for storing embedded docs
        index_name: name of the MongoDB Atlas Search index to use
        """
        self.loader = loader
        self.llm = llm
        self.mongo_collection = mongo_collection
        self.embedding_model = embedding_model

        if index_name:
            self.selected_index = index_name

        # Attempt to load documents
        # allow either a LangChain loader or a pre-loaded list of Document objects
        try:
            if hasattr(loader, "load"):
                docs = loader.load()
            elif isinstance(loader, list):
                docs = loader
            else:
                docs = []
            self.loaded_pages = [doc.page_content for doc in docs]
        except Exception as e:
            self.loaded_pages = []
            self.set_error(f"Error loading document: {e}")

        # Internal storage of split text per page
        self.chunks_by_page = []

        super().__init__(**kwargs)

        # Initialize a default user-editable template
        self.rag_prompt_template = (
            "<context>\n{context}\n</context>\n"
            "<question>{question}</question>\n"
            "<instructions>Answer the user QUESTION using the CONTEXT text above.\nKeep your answer grounded in the facts of the CONTEXT.\nIf the CONTEXT doesn’t contain the facts to answer the QUESTION, respond that you don't know.</instructions>"
        )

        # Build chunks (step 1)
        self._create_chunks_for_all_pages()
        self._update_highlighted_preview()

        # Build embeddings table from chunks (for UI display)
        self._build_embeddings_table()

        # Initialize empty docs table
        self.mongo_docs_table = []

        # Load vector indexes from MongoDB
        self._load_vector_indexes()

    # -----------------
    # Step 1: CHUNKING
    # -----------------
    def _create_chunks_for_all_pages(self):
        self.chunks_by_page = []
        table_accumulator = []
    
        if not self.loaded_pages:
            self.chunks_table = []
            return
    
        splitter = self._get_text_splitter(add_start_index=True)
        for p_idx, page_text in enumerate(self.loaded_pages):
            docs = splitter.create_documents([page_text])
            for c_idx, doc in enumerate(docs):
                table_accumulator.append({
                    "page_index": p_idx,
                    "chunk_index": c_idx,
                    "chunk_text": doc.page_content,
                    "start_offset": doc.metadata["start_index"],
                    "end_offset": doc.metadata["start_index"] + len(doc.page_content)
                })
        self.chunks_table = table_accumulator

    def _get_text_splitter(self, add_start_index=False):
        if self.split_strategy == "Recursive":
            return RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.overlap_size,
                add_start_index=add_start_index
            )
        elif self.split_strategy == "Markdown":
            return MarkdownTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.overlap_size,
                add_start_index=add_start_index
            )
        else:  # Default to Fixed strategy
            return CharacterTextSplitter(
                separator="",
                chunk_size=self.chunk_size,
                chunk_overlap=self.overlap_size,
                add_start_index=add_start_index
            )

    def _build_highlighted_html(self, page_text, chunks_info):
        if not page_text:
            return page_text

        coverage = [[] for _ in range(len(page_text))]
        for info in chunks_info:
            start = info.get("start_offset", 0)
            end = info.get("end_offset", 0)
            c_idx = info["chunk_index"]
            for i in range(start, min(end, len(page_text))):
                coverage[i].append(c_idx)

        colors = [
            "rgba(227, 252, 247, 1)",
            "rgba(249, 235, 255, 0.9)",
            "rgba(0, 210, 255, 0.3)",
            "rgba(233, 255, 153, 0.7)",
            "rgba(0, 110, 255, 0.3)"
        ]
        overlap_color = "rgba(144, 168, 84, 0.5)"

        def html_escape(txt):
            return txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

        def style_for(indices):
            if len(indices) > 1:
                return f'style="background-color:{overlap_color}"'
            elif len(indices) == 1:
                idx_mod = indices[0] % len(colors)
                return f'style="background-color:{colors[idx_mod]}"'
            else:
                return ""

        output = []
        if len(page_text) == 0:
            return ""

        span_buffer = page_text[0]
        last_cov = coverage[0]

        for i in range(1, len(page_text)):
            current_cov = coverage[i]
            if len(current_cov) != len(last_cov) or set(current_cov) != set(last_cov):
                output.append(f'<span {style_for(last_cov)}>{html_escape(span_buffer)}</span>')
                span_buffer = page_text[i]
                last_cov = current_cov
            else:
                span_buffer += page_text[i]

        if span_buffer:
            output.append(f'<span {style_for(last_cov)}>{html_escape(span_buffer)}</span>')

        return "".join(output)

    def _update_highlighted_preview(self):
        if 0 <= self.current_doc_index < len(self.loaded_pages):
            page_text = self.loaded_pages[self.current_doc_index]
            page_chunks_info = [
                row for row in self.chunks_table
                if row["page_index"] == self.current_doc_index
            ]
            self.document_preview = self._build_highlighted_html(page_text, page_chunks_info)
        else:
            self.document_preview = f"No page found at index {self.current_doc_index}"

    @traitlets.observe('current_doc_index')
    def _on_page_change(self, change):
        self._update_highlighted_preview()

    @traitlets.observe('chunk_size', 'split_strategy', 'overlap_size')
    def _on_chunk_settings_change(self, change):
        self._create_chunks_for_all_pages()
        self._update_highlighted_preview()
        self._build_embeddings_table()

    # -----------------
    # Step 2: EMBEDDING
    # -----------------
    def _load_vector_indexes(self):
        if self.mongo_collection is None:
            self.vector_indexes = []
            return
        try:
            all_indexes = list(self.mongo_collection.list_search_indexes())
            self.vector_indexes = [idx.get("name", "") for idx in all_indexes]
            if not self.vector_indexes:
                self.vector_indexes = []
        except Exception as e:
            if "command not found" in str(e).lower():
                idx_info = self.mongo_collection.index_information()
                self.vector_indexes = list(idx_info.keys())
            else:
                self.set_error(f"Error fetching search indexes: {e}")
                self.vector_indexes = []

        if self.selected_index and self.selected_index not in self.vector_indexes:
            self.set_error(f"Error: Provided vector index '{self.selected_index}' does not exist.")

    def _build_embeddings_table(self):
        data = []
        for row in self.chunks_table:
            # Copy all necessary fields from chunks_table to embeddings_table
            data.append({
                "chunk_text": row["chunk_text"],
                "page_index": row["page_index"],
                "chunk_index": row["chunk_index"],
                "start_offset": row.get("start_offset", 0),
                "end_offset": row.get("end_offset", 0)
            })
        self.embeddings_table = data
        self.embedding_ready = False
        self.loaded_in_mongo = False

    @traitlets.observe("command")
    def _on_command(self, change):
        cmd = change["new"]
        if cmd == "load_into_mongo":
            self.load_into_mongo()
        elif cmd == "rag_ask":
            self.run_rag()
        self.command = ""

    def load_into_mongo(self):
        # 1 – flush the collection, then (re‑)add every chunk
        self.mongo_collection.delete_many({})
        vector_store = MongoDBAtlasVectorSearch(
            collection=self.mongo_collection,
            embedding=self.embedding_model,
            index_name=self.selected_index,
            relevance_score_fn="cosine",
        )
        texts = [r["chunk_text"] for r in self.chunks_table]
        vector_store.add_texts(texts, metadatas=[{} for _ in texts])

        # 2 – sanity‑check the insert
        inserted = len(texts)
        total_in_db = self.mongo_collection.count_documents({})
        # print(f"{inserted} chunks inserted – collection now holds {total_in_db} docs")

        # 3 – build a preview table (OPTIONAL: keep the slice if your UI bogs down)
        preview_cursor = self.mongo_collection.find(
            {}, {"_id": 1, "text": 1, "embedding": 1}
        )  # ← removed .limit(10)

        self.mongo_docs_table = [
            {
                "_id": str(doc["_id"]),
                "text": (doc.get("text", "")[:60] + "...") if len(doc.get("text", "")) > 60 else doc.get("text", ""),
                "embedding": doc.get("embedding", [])[:5] + ["..."] if len(doc.get("embedding", [])) > 5 else doc.get("embedding", []),
            }
            for doc in preview_cursor
        ]
        self.loaded_in_mongo = True

    # -----------------
    # Step 3: RAG
    # -----------------
    def run_rag(self):
        if not self.selected_index:
            self.set_error("No vector index was specified.")
            return
        if not self.embedding_model:
            self.set_error("No embedding model provided.")
            return
    
        query = self.rag_query.strip()
        if not query:
            self.set_error("No query provided.")
            return
    
        try:
            # 1) Create the MongoDBAtlasVectorSearch instance
            vector_store = MongoDBAtlasVectorSearch(
                collection=self.mongo_collection,
                embedding=self.embedding_model,
                index_name=self.selected_index,
                relevance_score_fn="cosine"
            )
    
            # 2) Retrieve docs with scores using similarity search
            docs_with_scores = vector_store.similarity_search_with_score(query, k=5)
            # print("Number of retrieved docs:", len(docs_with_scores))
    
            rag_data = []
            for i, (doc, score) in enumerate(docs_with_scores):
                # print(f"---- Document #{i} ----")
                # print("Document Content (truncated to 200 chars):", doc.page_content[:200], "...")
                # print("Metadata:", doc.metadata)
                # print("Similarity Score:", score)
    
                rag_data.append({
                    "score": float(score),
                    "content": doc.page_content,
                    "metadata": doc.metadata
                })
    
            self.rag_results = rag_data
    
            # 3) Build final prompt using the user-provided template and run LLM chain
            context_str = "\n\n".join([doc.page_content for (doc, _) in docs_with_scores])
            template = self.rag_prompt_template  # Use user-editable prompt template here
            prompt = ChatPromptTemplate.from_template(template)
            prompt_message = prompt.format_prompt(context=context_str, question=query)
            # print("Final prompt message sent to LLM:")
            # print(prompt_message.to_messages())
    
            model = self.llm
            parse_output = StrOutputParser()
            naive_rag_chain = {
                "context": (lambda x: context_str),
                "question": RunnablePassthrough()
            } | prompt | model | parse_output
    
            answer = naive_rag_chain.invoke(query)
            #print("Generated answer:", answer)
            self.rag_answer = answer
    
        except Exception as e:
            self.set_error(f"RAG Error: {e}")