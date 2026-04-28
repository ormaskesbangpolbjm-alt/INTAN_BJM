import io
import re
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

try:
    from chandra.model import InferenceManager
    from chandra.model.schema import BatchInputItem
except ImportError:
    # Fallback/Dummy for testing if chandra is not yet fully installed
    InferenceManager = None
    BatchInputItem = None

app = FastAPI(title="Local OCR Backend via Chandra")

# Izinkan CORS untuk frontend lokal
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inisialisasi model secara global (menggunakan mode HF/Local)
# Jika GPU tidak memadai, ini bisa diubah sesuai konfigurasi chandra.
chandra_model = None
if InferenceManager is not None:
    print("Memuat Model Chandra OCR... Silakan tunggu.")
    try:
         chandra_model = InferenceManager(method="hf")
         print("Model Chandra berhasil dimuat!")
    except Exception as e:
         print(f"Gagal memuat model: {e}")

class OCRRequest(BaseModel):
    image_base64: str
    doc_type: str  # "ktp", "rekening", atau "npwp"

def parse_ktp(markdown_text: str) -> dict:
    # Parsing basic menggunakan regex sederhana pada keluaran markdown KTP
    nik = re.search(r"NIK\s*[:=\n]?\s*(\d{16})", markdown_text, re.IGNORECASE)
    nama = re.search(r"Nama\s*[:=\n]?\s*([A-Za-z\s\.,]+)", markdown_text, re.IGNORECASE)
    jk = re.search(r"Jenis Kelamin\s*[:=\n]?\s*(LAKI-LAKI|PEREMPUAN|L|P)", markdown_text, re.IGNORECASE)
    alamat = re.search(r"Alamat\s*[:=\n]?\s*([^\n]+)", markdown_text, re.IGNORECASE)

    extracted = {
        "nik": nik.group(1).strip() if nik else "",
        "nama": nama.group(1).strip() if nama else "",
        "jenis_kelamin": "Laki-laki" if jk and "L" in jk.group(1).upper() else ("Perempuan" if jk else ""),
        "alamat": alamat.group(1).strip() if alamat else ""
    }
    return extracted

def parse_rekening(markdown_text: str) -> dict:
    norek = re.search(r"(\d{4,}[\-\s]?\d{4,}[\-\s]?\d{2,})", markdown_text)
    bank_match = re.search(r"(Bank\s+[A-Za-z]+|BCA|BNI|BRI|Mandiri|BSI|BTN)", markdown_text, re.IGNORECASE)
    
    return {
        "no_rekening": re.sub(r"[^\d]", "", norek.group(1)) if norek else "",
        "bank": bank_match.group(1).strip() if bank_match else ""
    }

def parse_npwp(markdown_text: str) -> dict:
    npwp_match = re.search(r"(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\.\-\s]?\d{1}[\.\-\s]?\d{3}[\.\s]?\d{3})", markdown_text)
    if npwp_match:
        # Standarisasi format NPWP
        raw = re.sub(r"[^\d]", "", npwp_match.group(1))
        if len(raw) >= 15:
            formatted = f"{raw[0:2]}.{raw[2:5]}.{raw[5:8]}.{raw[8]}-{raw[9:12]}.{raw[12:15]}"
            return {"npwp": formatted}
    return {"npwp": ""}

@app.post("/api/scan")
async def scan_document(payload: OCRRequest):
    if not chandra_model:
        raise HTTPException(status_code=500, detail="Chandra Model Is Not Initialized Properly.")
    
    try:
        # Decode base64 image
        base64_data = payload.image_base64
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
            
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Kirim ke model chandra (menggunakan ocr regular)
        batch = [BatchInputItem(image=img, prompt_type="ocr")]
        results = chandra_model.generate(batch, include_images=False)
        markdown_output = results[0].markdown if results else ""
        
        extracted_json = {}
        if payload.doc_type == "ktp":
            extracted_json = parse_ktp(markdown_output)
        elif payload.doc_type == "rekening":
            extracted_json = parse_rekening(markdown_output)
        elif payload.doc_type == "npwp":
            extracted_json = parse_npwp(markdown_output)
            
        print(f"--- OCR ({payload.doc_type}) RESULT ---")
        print(markdown_output)
        print("--- EXTRACTED ---")
        print(extracted_json)
        
        return extracted_json

    except Exception as e:
        print(f"Error OCring document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Menjalankan server pada port 8080 lokal
    uvicorn.run(app, host="0.0.0.0", port=8080)
