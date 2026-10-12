import os
import urllib.request

DEST_DIR = r"D:\MORPH-AI\frontend\public\products"
os.makedirs(DEST_DIR, exist_ok=True)

# 22 diverse products with fashion apparel images
IMAGES = {
    # Áo thun (5)
    "ao-thun-essential.jpg": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
    "ao-thun-oversized-heavyweight.jpg": "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80",
    "ao-thun-supima-crewneck.jpg": "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
    "ao-thun-waffle-long-sleeve.jpg": "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80",
    "ao-thun-striped-relaxed.jpg": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
    
    # Sơ mi (5)
    "so-mi-oxford-classic.jpg": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80",
    "so-mi-linen-thoang-khi.jpg": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80",
    "so-mi-cuban-collar.jpg": "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&q=80",
    "so-mi-denim-nhe.jpg": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80",
    "so-mi-co-tru-minimal.jpg": "https://images.unsplash.com/photo-1620012253295-c15c429fccf8?w=800&q=80",
    
    # Áo khoác (4)
    "ao-khoac-blazer-linen.jpg": "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80",
    "ao-khoac-bomber-minimal.jpg": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80",
    "ao-khoac-trench-coat-ngan.jpg": "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&q=80",
    "ao-khoac-cardigan-len.jpg": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80",
    
    # Quần (4)
    "quan-tay-pleated-wide-leg.jpg": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80",
    "quan-khaki-chino-straight.jpg": "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&q=80",
    "quan-linen-cap-chun.jpg": "https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&q=80",
    "quan-jeans-regular-selvedge.jpg": "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&q=80",
    
    # Váy (4)
    "chan-vay-pleated-midi.jpg": "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&q=80",
    "chan-vay-chu-a-linen.jpg": "https://images.unsplash.com/photo-1582142407894-ec85a1260a46?w=800&q=80",
    "dam-suong-linen-minimal.jpg": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&q=80",
    "chan-vay-jean-xe-ta.jpg": "https://images.unsplash.com/photo-1560243563-062bfc001d68?w=800&q=80"
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

success = 0
for filename, url in IMAGES.items():
    dest_path = os.path.join(DEST_DIR, filename)
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 10000:
        print(f"Already exists: {filename}")
        success += 1
        continue
    try:
        print(f"Downloading {filename}...")
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp, open(dest_path, "wb") as f:
            f.write(resp.read())
        size = os.path.getsize(dest_path)
        print(f"Saved {filename} ({size} bytes)")
        success += 1
    except Exception as e:
        print(f"Failed {filename}: {e}")

print(f"\nDone: {success}/{len(IMAGES)} images ready.")
