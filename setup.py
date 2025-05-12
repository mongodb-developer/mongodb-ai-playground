import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="mongodb_ai_playground",
    version="0.0.7",
    author="Thibaut Gourdel",
    author_email="thibaut.gourdel@mongodb.com",
    description="A playground for building RAG applications with MongoDB and Langchain",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/tgourdel/mongodb-rag-playground",
    packages=setuptools.find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.7',
    install_requires=[
        "anywidget",
        "traitlets",
        "langchain",
        "langchain_mongodb",
        "langchain_core"
    ],
    include_package_data=True,
    package_data={
        "mongodb_ai_playground": ["index.js", "index.css"],
    },
)
