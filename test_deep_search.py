import json
import re

with open('data/book_2.json', 'r', encoding='utf-8') as f:
    chapters = json.load(f)

query = "ישראל"
for chap in chapters:
    text = chap.get('text', '')
    if not text: continue
    
    # Strip HTML tags
    text = re.sub('<[^<]+>', '', text)
    if query in text:
        print("Found in", chap['title'])
        break
