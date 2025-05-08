# MongoDB AI Playground

MongoDB AI Playground is a set of interactive widgets to explore, test, and visualize MongoDB-powered AI capabilities, including Retrieval-Augmented Generation (RAG) and GraphRAG workflows, using modern LLM and vector search integrations.

---

## Overview

The **MongoDB AI Playground** provides interactive widgets for experimenting with advanced AI capabilities on MongoDB, including:

- **RAG (Retrieval-Augmented Generation)**: Chunk, embed, store, and query documents using MongoDB Atlas Vector Search and LLMs.
- **Graph RAG**: Ingest documents as knowledge graphs, visualize relationships, and perform graph-based question answering using LLMs and MongoDB.

Built as a set of [AnyWidget](https://anywidget.dev/) Jupyter widgets, this playground is designed for rapid prototyping, learning, and demonstration of GenAI + MongoDB workflows.

---

## Features

- 📄 **Document Chunking**: Flexible strategies (fixed, recursive, markdown) for splitting documents.
- 🧠 **Embeddings & Vector Search**: Store and search embeddings in MongoDB Atlas using [langchain-mongodb](https://github.com/mongodb-developer/langchain-mongodb).
- 🔎 **RAG Playground UI**: Step-by-step interface for chunking, embedding, and querying.
- 🕸️ **Knowledge Graph RAG**: Build and visualize entity/relation graphs from docs and run graph-based QA.
- 🧩 **Extensible**: Built for experimentation with LangChain so that you can use different loaders, embeddings models, LLMs and more.

---

## Installation

1. **Install dependencies:**

```bash
pip install mongodb-ai-playground
```

The mongodb-ai-playground depends on the following Python libraries: `anywidget`, `ipywidgets`, `langchain`, `langchain-mongodb`, and `pymongo`.

2. **Enable Jupyter Widgets:**

Make sure you have JupyterLab or Jupyter Notebook with widget support enabled.

---

## Usage

### 1. RAG Playground

```python
from mongodb_ai_playground import MongoDBRAGPlayground

# Example: Pass your own loader, embedding model, LLM, and MongoDB collection
widget = MongoDBRAGPlayground(
    loader=...,              # LangChain loader
    embedding_model=...,     # LangChain embedding model 
    llm=...,                 # LangChain Chat Model (LLM) for answering questions (OpenAI, Claude, DeepSeek, etc.)
    mongo_collection=...,    # PyMongo collection for storing vectors
    index_name=...           # Name of your Atlas Vector Search index
)
widget # Display the playground widget
```

- All interactions are performed via the interactive UI in Jupyter-compatible environments.
- Visualize chunking, embeddings, vector search results, and knowledge graphs.

---

## Project Structure

```
mongodb_ai_playground/
├── rag_widget.py         # RAG playground widget (chunking, embedding, RAG)
├── graphrag_widget.py    # Graph RAG playground widget (graph ingest, QA)
├── index.js              # JS frontend for RAG widget
├── graphrag.js           # JS frontend for Graph RAG widget
├── index.css             # Shared widget styles
├── __init__.py           # Exports widgets
...
```

---

## Requirements
- Python 3.7+
- Jupyter widget compatible environments (JupyterLab, Jupyter Notebook, Colab, Marimo, etc.) 
- MongoDB Atlas deployment (for vector/graph storage)
- Any LLM and embedding model using LangChain components (OpenAI, HuggingFace, etc.)

---

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- [AnyWidget](https://anywidget.dev/)
- [LangChain](https://python.langchain.com/)
- [langchain-mongodb](https://github.com/mongodb-developer/langchain-mongodb)
- [PyMongo](https://pymongo.readthedocs.io/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)

## Additional Resources

* [GenAI Showcase](https://github.com/mongodb-developer/GenAI-Showcase)
* [AI Learning Hub](https://www.mongodb.com/resources/use-cases/artificial-intelligence?utm_campaign=ai_learning_hub&utm_source=github&utm_medium=referral)
* [GenAI Community Forum](https://www.mongodb.com/community/forums/c/generative-ai/162)
* [Tutorials and code examples from our official docs](https://github.com/mongodb/docs-notebooks)