import os
import pickle
import json
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
from langchain_community.document_loaders import WebBaseLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb

# --- CONFIGURATION ---
INITIAL_URL = "https://docs.blender.org/manual/en/latest/index.html"
PERSIST_DIRECTORY = "./recrsive_chroma_db"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"

# Two separate batch sizes
EMBED_BATCH_SIZE = 100    # safe for GTX 1650 (4 GB VRAM)
DB_BATCH_SIZE = 1000     # safe for ChromaDB compaction

# Adjust chunk settings
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200

# --- Caching Utility Functions ---
def save_pickle(obj, path):
    with open(path, "wb") as f:
        pickle.dump(obj, f)

def load_pickle(path):
    with open(path, "rb") as f:
        return pickle.load(f)

# --- Core Logic Functions ---
def get_all_website_links(url):
    urls = set()
    domain_name = urlparse(url).netloc
    queue = [url]
    visited = {url}

    pbar = tqdm(desc="Discovering links")
    while queue:
        current_url = queue.pop(0)
        pbar.update(1)
        pbar.set_postfix_str(f"Found: {len(urls)} links")

        try:
            response = requests.get(current_url, timeout=5)
            if response.status_code == 200 and 'text/html' in response.headers.get('Content-Type', ''):
                soup = BeautifulSoup(response.content, "html.parser")
                for a_tag in soup.find_all("a", href=True):
                    href = a_tag.attrs["href"]
                    full_url = urljoin(current_url, href)
                    full_url = urlparse(full_url)._replace(query="", fragment="").geturl()

                    if domain_name in urlparse(full_url).netloc and full_url not in visited:
                        urls.add(full_url)
                        visited.add(full_url)
                        queue.append(full_url)
        except requests.exceptions.RequestException:
            continue

    pbar.close()
    return list(urls)

def scrape_links_robustly(links):
    all_docs = []
    for link in tqdm(links, desc="Scraping web pages"):
        try:
            time.sleep(0.1)  # be polite
            loader = WebBaseLoader(link)
            docs = loader.load()
            all_docs.extend(docs)
        except Exception:
            continue
    return all_docs

# --- Main Pipeline ---
def main():
    # Step 1: Discover links
    if os.path.exists("discovered_links.json"):
        with open("discovered_links.json", "r") as f:
            all_links = json.load(f)
        print(f"✅ Loaded {len(all_links)} cached links.")
    else:
        print("Step 1: Discovering all website links...")
        all_links = get_all_website_links(INITIAL_URL)
        with open("discovered_links.json", "w") as f:
            json.dump(all_links, f)
        print(f"✅ Discovered and saved {len(all_links)} unique links.")

    # Step 2: Scrape content
    if os.path.exists("scraped_docs.pkl"):
        all_documents = load_pickle("scraped_docs.pkl")
        print("✅ Loaded cached web documents.")
    else:
        print("\nStep 2: Scraping content...")
        all_documents = scrape_links_robustly(all_links)
        save_pickle(all_documents, "scraped_docs.pkl")
    print(f"✅ Scraped {len(all_documents)} pages successfully.")

    # Step 3: Split into chunks
    if os.path.exists("chunks.pkl"):
        chunks = load_pickle("chunks.pkl")
        print("✅ Loaded cached chunks.")
    else:
        print("\nStep 3: Splitting documents into chunks...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP
        )

        all_chunks = []
        for document in tqdm(all_documents, desc="Splitting documents"):
            split_chunks = text_splitter.split_documents([document])
            all_chunks.extend(split_chunks)
        chunks = all_chunks

        save_pickle(chunks, "chunks.pkl")
    print(f"✅ Split into {len(chunks)} text chunks.")

    # Step 4: Embeddings + ChromaDB
    print("\nStep 4: Creating embeddings and storing in ChromaDB...")
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device="cuda")
    db_client = chromadb.PersistentClient(path=PERSIST_DIRECTORY)
    vector_db = db_client.get_or_create_collection("web_content")

    existing_ids = set(vector_db.get(include=[])['ids'])
    print(f"🔄 Vector DB has {len(existing_ids)} documents. Resuming if necessary.")

    docs_to_add = []
    for i, doc in enumerate(chunks):
        doc_id = str(i)
        if doc_id not in existing_ids:
            docs_to_add.append((doc_id, doc))

    if not docs_to_add:
        print("✅ Vector DB is already up-to-date.")
    else:
        print(f"➕ Adding {len(docs_to_add)} new documents to the vector DB...")
        for i in tqdm(range(0, len(docs_to_add), DB_BATCH_SIZE), desc="Embedding and adding to DB"):
            batch_items = docs_to_add[i:i + DB_BATCH_SIZE]

            batch_ids = [item[0] for item in batch_items]
            batch_docs = [item[1] for item in batch_items]

            # embed in smaller GPU batches
            embeddings = []
            for j in range(0, len(batch_docs), EMBED_BATCH_SIZE):
                sub_batch = batch_docs[j:j + EMBED_BATCH_SIZE]
                sub_embeddings = embedding_model.encode(
                    [doc.page_content for doc in sub_batch],
                    batch_size=EMBED_BATCH_SIZE,
                    convert_to_numpy=True,
                    show_progress_bar=False
                )
                embeddings.extend(sub_embeddings.tolist())

            # write this batch to DB
            vector_db.add(
                embeddings=embeddings,
                documents=[doc.page_content for doc in batch_docs],
                metadatas=[doc.metadata for doc in batch_docs],
                ids=batch_ids
            )

            time.sleep(0.5)  # give DB a tiny breather

    print(f"\n🎉🚀 All done! Your vector database is complete with {vector_db.count()} documents.")

if __name__ == "__main__":
    main()