import json
import os
import re
import urllib.request
import ssl

os.makedirs("data/covers", exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def generate_svg_cover(book_id, title, subtitle, theme_idx=1):
    palettes = [
        ("#0f172a", "#1e293b", "#d4af37"),
        ("#1a120b", "#3c2a21", "#e5c158"),
        ("#0a192f", "#112240", "#ffd700"),
    ]
    bg1, bg2, gold = palettes[(book_id) % len(palettes)]
    # Split title into up to 2 lines if long
    words = title.split()
    if len(words) > 2:
        line1 = " ".join(words[:2])
        line2 = " ".join(words[2:])
    else:
        line1 = title
        line2 = ""

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 580" width="400" height="580">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{bg1}"/>
      <stop offset="100%" stop-color="{bg2}"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{gold}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#fff3b0" stop-opacity="1"/>
      <stop offset="100%" stop-color="{gold}" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <rect width="400" height="580" fill="url(#bgGrad)"/>
  <rect x="22" y="22" width="356" height="536" rx="8" fill="none" stroke="url(#goldGrad)" stroke-width="2" opacity="0.75"/>
  <rect x="30" y="30" width="340" height="520" rx="5" fill="none" stroke="{gold}" stroke-width="0.8" opacity="0.4"/>
  <circle cx="200" cy="120" r="34" fill="none" stroke="{gold}" stroke-width="1.2" opacity="0.45"/>
  <path d="M180 120 L220 120 M200 100 L200 140" stroke="{gold}" stroke-width="1.2" opacity="0.5"/>
  <text x="200" y="90" text-anchor="middle" fill="{gold}" font-family="'Frank Ruhl Libre', Georgia, serif" font-size="15" letter-spacing="2" opacity="0.85">מכון מניטו • ארכיון כתבים</text>
  <text x="200" y="255" text-anchor="middle" fill="#ffffff" font-family="'Frank Ruhl Libre', Georgia, serif" font-weight="bold" font-size="34">{line1}</text>
  {f'<text x="200" y="302" text-anchor="middle" fill="#ffffff" font-family="Frank Ruhl Libre, Georgia, serif" font-weight="bold" font-size="32">{line2}</text>' if line2 else ''}
  <line x1="120" y1="335" x2="280" y2="335" stroke="url(#goldGrad)" stroke-width="2.5"/>
  <text x="200" y="375" text-anchor="middle" fill="{gold}" font-family="'Heebo', sans-serif" font-size="18" opacity="0.9">{subtitle}</text>
  <text x="200" y="505" text-anchor="middle" fill="#cbd5e1" font-family="'Frank Ruhl Libre', Georgia, serif" font-size="16" opacity="0.8">הרב יהודא לאון אשכנזי (מניטו) זצ״ל</text>
</svg>'''
    path = f"data/covers/book_{book_id}.svg"
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return path

cat = json.load(open("data/catalog.json", encoding="utf-8"))

# Series mapping helper
def detect_series(book):
    t = book["title"]
    if t.startswith("סוד מדרש התולדות"):
        m = re.search(r'(\d+)', t)
        return ("סוד מדרש התולדות", int(m.group(1)) if m else 1)
    if t.startswith("שערי דמעה"):
        m = re.search(r'(\d+)', t)
        return ("שערי דמעה", int(m.group(1)) if m else 1)
    if t.startswith("סוד לשון הקודש"):
        m = re.search(r'(\d+)', t)
        return ("סוד לשון הקודש", int(m.group(1)) if m else 1)
    if t.startswith("סוד העברי"):
        m = re.search(r'(\d+)', t)
        return ("סוד העברי", int(m.group(1)) if m else 1)
    if "מועד" in t:
        return ("מועדי ישראל", 1 if "מניטו" in t else 2)
    if "(FR)" in t or "Un Hébreu" in t:
        return ("כתבים בצרפתית", book["id"])
    return ("ספרי יסוד ושיעורים", book["id"])

for b in cat:
    bid = b["id"]
    series_name, series_vol = detect_series(b)
    b["series"] = series_name
    b["seriesVol"] = series_vol

    # Check cover
    remote_url = b.get("remoteImgUrl") or (b.get("imgUrl") if b.get("imgUrl", "").startswith("http") else "")
    if remote_url:
        b["remoteImgUrl"] = remote_url
        ext = os.path.splitext(remote_url.split("?")[0])[1].lower() or ".jpg"
        local_cover = f"data/covers/book_{bid}{ext}"
        if not os.path.exists(local_cover) or os.path.getsize(local_cover) < 500:
            try:
                req = urllib.request.Request(remote_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                    data = resp.read()
                    if len(data) >= 500:
                        with open(local_cover, "wb") as out:
                            out.write(data)
                        print(f"Downloaded cover for book {bid}: {local_cover}")
            except Exception as e:
                print(f"Could not download remote cover for {bid}: {e}")
        if os.path.exists(local_cover) and os.path.getsize(local_cover) >= 500:
            b["imgUrl"] = local_cover
        else:
            svg_path = generate_svg_cover(bid, b["title"], b.get("categoryLabel", "מכון מניטו"))
            b["imgUrl"] = svg_path
    else:
        svg_path = generate_svg_cover(bid, b["title"], b.get("categoryLabel", "מכון מניטו"))
        b["imgUrl"] = svg_path
        print(f"Generated SVG cover for book {bid}: {svg_path}")

    # Enrich chapters with wordCount & readingMinutes
    bf = f"data/book_{bid}.json"
    total_words = 0
    total_mins = 0
    if os.path.exists(bf):
        chaps = json.load(open(bf, encoding="utf-8"))
        for ch in chaps:
            raw_html = ch.get("text", "")
            clean_txt = re.sub(r'<[^>]+>', ' ', raw_html)
            words = [w for w in clean_txt.split() if w.strip()]
            wc = len(words)
            mins = max(1, round(wc / 150)) if wc > 0 else 5
            ch["wordCount"] = wc
            ch["readingMinutes"] = mins
            total_words += wc
            total_mins += mins
        json.dump(chaps, open(bf, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        b["chaptersCount"] = len(chaps)
        b["totalWords"] = total_words
        b["totalReadingMinutes"] = total_mins

# Sort catalog logically so series stay together (e.g. Sod Midrash HaToladot 1..10 in sequence)
series_priority = {
    "ספרי יסוד ושיעורים": 1,
    "סוד מדרש התולדות": 2,
    "שערי דמעה": 3,
    "סוד לשון הקודש": 4,
    "סוד העברי": 5,
    "מועדי ישראל": 6,
    "כתבים בצרפתית": 7,
}
cat.sort(key=lambda x: (series_priority.get(x.get("series", ""), 99), x.get("seriesVol", 99), x["id"]))

json.dump(cat, open("data/catalog.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("Saved ordered catalog.json with series & covers.")

# Build Parasha, Holidays & Topics Index across all 271 chapters
TOPICS_DEFINITIONS = [
    # Parashot & Genesis / Exodus
    {"id": "bereshit", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "בראשית ומעשה הבריאה", "keywords": ["בראשית", "בריאה", "מעשה בראשית", "אדם הראשון", "גן עדן", "קין והבל", "קין", "הבל"]},
    {"id": "noach", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "נח, המבול ודור הפלגה", "keywords": ["נח", "מבול", "המבול", "תיבת נח", "דור הפלגה", "מגדל בבל", "שם חם ויפת"]},
    {"id": "lech_lecha", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "לך לך ואברהם העברי", "keywords": ["לך לך", "לך-לך", "אברהם", "אברם", "מלכי צדק", "מלכי-צדק", "ברית בין הבתרים", "לוט"]},
    {"id": "vayera", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "וירא, סדום ועקידת יצחק", "keywords": ["וירא", "סדום", "עקידת יצחק", "העקידה", "עקידה", "ישמעאל", "הגר", "אבימלך"]},
    {"id": "chayei_sarah", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "חיי שרה ומערת המכפלה", "keywords": ["חיי שרה", "שרה אמנו", "מערת המכפלה", "אליעזר", "רבקה"]},
    {"id": "toldot", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "תולדות: יצחק, יעקב ועשו", "keywords": ["פרשת תולדות", "יעקב ועשו", "עשו", "בכורה", "ברכות יצחק", "יצחק אבינו"]},
    {"id": "vayetzei_vayishlach", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "ויצא וישלח: מאבק יעקב וישראל", "keywords": ["ויצא", "וישלח", "סולם יעקב", "לבן", "רחל ולאה", "שכם", "דינה", "פניאל", "מלאך עשו"]},
    {"id": "joseph", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "וישב, מקץ, ויגש, ויחי: יוסף ואחיו", "keywords": ["וישב", "מקץ", "ויגש", "ויחי", "יוסף ואחיו", "מכירת יוסף", "יהודה ותמר", "בנימין", "אפרים ומנשה"]},
    {"id": "shemot", "group": "parasha", "groupLabel": "פרשות השבוע והתורה", "title": "שמות, משה רבנו ויציאת מצרים", "keywords": ["שמות", "משה רבנו", "הסנה", "גלות מצרים", "יציאת מצרים", "פרעה", "קריעת ים סוף", "מתן תורה", "סיני"]},

    # Holidays (Moed)
    {"id": "rosh_hashana", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "אלול וראש השנה", "keywords": ["ראש השנה", "אלול", "שופר", "יום הדין", "מלכויות", "זכרונות", "שופרות"]},
    {"id": "yom_kippur", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "יום הכיפורים ותשובה", "keywords": ["יום הכיפורים", "יום כיפור", "כיפור", "עבודת הכהן הגדול", "שעיר לעזאזל", "יונה", "כל נדרי"]},
    {"id": "sukkot", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "חג הסוכות ושמיני עצרת", "keywords": ["סוכות", "סוכה", "ארבעת המינים", "הושענא", "שמיני עצרת", "שמחת תורה", "אושפיזין"]},
    {"id": "chanukah_purim", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "חנוכה ופורים", "keywords": ["חנוכה", "חשמונאים", "יוון", "פורים", "מגילת אסתר", "אסתר", "מרדכי", "עמלק"]},
    {"id": "pesach", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "חג הפסח וליל הסדר", "keywords": ["פסח", "ליל הסדר", "הגדה", "מצה", "חמץ", "ארבע כוסות", "שיר השירים"]},
    {"id": "shavuot", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "ספירת העומר וחג השבועות", "keywords": ["שבועות", "ספירת העומר", "עומר", "מגילת רות", "רות", "מתן תורה", "עשרת הדברות"]},
    {"id": "tisha_beav", "group": "moed", "groupLabel": "חגי ומועדי ישראל", "title": "בין המצרים, תשעה באב וירושלים", "keywords": ["תשעה באב", "בין המצרים", "חורבן", "איכה", "בית המקדש", "ירושלים", "ציון"]},

    # Core Philosophy Themes
    {"id": "ivri_identity", "group": "theme", "groupLabel": "נושאי יסוד במשנת מניטו", "title": "זהות: עברי, ישראלי ויהודי", "keywords": ["העברי", "זהות עברית", "עבריות", "יהודי וישראלי", "זהות ישראלית"]},
    {"id": "redemption_mashiach", "group": "theme", "groupLabel": "נושאי יסוד במשנת מניטו", "title": "משיח בן יוסף, משיח בן דוד והגאולה", "keywords": ["משיח בן יוסף", "משיח בן דוד", "מספד למשיח", "גאולה", "שיבת ציון", "ציונות"]},
    {"id": "lashon_kodesh", "group": "theme", "groupLabel": "נושאי יסוד במשנת מניטו", "title": "סוד לשון הקודש, הדיבור והכתב", "keywords": ["לשון הקודש", "הדיבור והכתב", "תורה שבעל פה", "תורה שבכתב", "אותיות"]},
]

topics_output = []
for topic in TOPICS_DEFINITIONS:
    matches = []
    for b in cat:
        bid = b["id"]
        bf = f"data/book_{bid}.json"
        if not os.path.exists(bf):
            continue
        chaps = json.load(open(bf, encoding="utf-8"))
        for ch in chaps:
            title_txt = ch.get("title", "")
            raw_html = ch.get("text", "")
            clean_txt = re.sub(r'<[^>]+>', ' ', raw_html)
            score = 0
            matched_kws = []
            for kw in topic["keywords"]:
                if kw in title_txt:
                    score += 10
                    matched_kws.append(kw)
                else:
                    cnt = clean_txt.count(kw)
                    if cnt >= 2:
                        score += min(cnt, 8)
                        matched_kws.append(kw)
            if score >= 4:
                matches.append({
                    "bookId": bid,
                    "bookTitle": b["title"],
                    "chapterId": ch["id"],
                    "chapterTitle": title_txt,
                    "readingMinutes": ch.get("readingMinutes", 5),
                    "score": score,
                    "keywords": matched_kws[:3]
                })
    matches.sort(key=lambda x: (-x["score"], x["bookId"], x["chapterId"]))
    topics_output.append({
        "id": topic["id"],
        "group": topic["group"],
        "groupLabel": topic["groupLabel"],
        "title": topic["title"],
        "count": len(matches),
        "items": matches[:40]
    })

json.dump(topics_output, open("data/topics_index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"Generated data/topics_index.json with {len(topics_output)} topics.")

# --- Build Smart Cross-References & Related Chapters (across all 271 chapters) ---
CONCEPT_LEXICON = [
    "אדם הראשון", "קין והבל", "קין", "הבל", "נח", "המבול", "דור הפלגה", "מגדל בבל",
    "אברהם", "מלכי צדק", "ברית בין הבתרים", "סדום", "עקידת יצחק", "העקידה", "ישמעאל",
    "שרה", "מערת המכפלה", "רבקה", "יצחק", "יעקב ועשו", "עשו", "בכורה", "סולם יעקב",
    "לבן", "רחל ולאה", "דינה", "שכם", "פניאל", "יוסף ואחיו", "מכירת יוסף", "יהודה ותמר",
    "יוסף", "יהודה", "בנימין", "אפרים ומנשה", "משה רבנו", "הסנה", "יציאת מצרים",
    "פרעה", "קריעת ים סוף", "מתן תורה", "סיני", "עשרת הדברות", "מרה", "שבת",
    "ראש השנה", "אלול", "שופר", "יום הכיפורים", "תשובה", "יונה", "סוכות", "שמיני עצרת",
    "חנוכה", "פורים", "מגילת אסתר", "עמלק", "פסח", "ליל הסדר", "הגדה", "מצה",
    "שבועות", "ספירת העומר", "מגילת רות", "תשעה באב", "בין המצרים", "חורבן", "ירושלים",
    "העברי", "זהות עברית", "משיח בן יוסף", "משיח בן דוד", "גאולה", "שיבת ציון", "גלות",
    "לשון הקודש", "הדיבור והכתב", "תורה שבעל פה", "תורה שבכתב", "אחווה", "תולדות",
    "מוסר", "נבואה", "חכמה", "קבלה", "מהר\"ל", "רש\"י", "מדרש", "קדושה", "ברכה"
]

all_chapters_records = []
books_chapters_map = {}

for b in cat:
    bid = b["id"]
    bf = f"data/book_{bid}.json"
    if not os.path.exists(bf):
        continue
    chaps = json.load(open(bf, encoding="utf-8"))
    books_chapters_map[bid] = chaps
    for ch in chaps:
        title_txt = ch.get("title", "")
        raw_html = ch.get("text", "")
        clean_txt = re.sub(r'<[^>]+>', ' ', raw_html)
        
        # Extract concept weights for this chapter
        concept_scores = {}
        for kw in CONCEPT_LEXICON:
            in_title = kw in title_txt
            cnt = clean_txt.count(kw)
            if in_title or cnt >= 2:
                concept_scores[kw] = (12 if in_title else 0) + min(cnt, 10)
        
        # Extract significant title words (length >= 3)
        clean_title_only = title_txt.replace(b["title"], "").replace(":", " ")
        title_tokens = set(
            w.strip(".,;:()[]\"'״׳-")
            for w in clean_title_only.split()
            if len(w.strip(".,;:()[]\"'״׳-")) >= 3 and w not in {"פרק", "שיעור", "חלק", "ספר", "מתוך", "עמוד", "הקדמה", "מבוא"}
        )

        all_chapters_records.append({
            "bookId": bid,
            "bookTitle": b["title"],
            "series": b.get("series", ""),
            "chapterId": ch["id"],
            "chapterTitle": title_txt,
            "readingMinutes": ch.get("readingMinutes", 5),
            "concepts": concept_scores,
            "titleTokens": title_tokens,
            "ref": ch
        })

# Compute top 4 related chapters for each chapter
for rec in all_chapters_records:
    scored_candidates = []
    for cand in all_chapters_records:
        if cand["bookId"] == rec["bookId"] and cand["chapterId"] == rec["chapterId"]:
            continue
        
        shared_concepts = []
        sim_score = 0
        for kw, w1 in rec["concepts"].items():
            w2 = cand["concepts"].get(kw, 0)
            if w2 > 0:
                sim_score += min(w1, w2)
                shared_concepts.append((min(w1, w2), kw))
        
        # Shared title tokens boost
        shared_tokens = rec["titleTokens"].intersection(cand["titleTokens"])
        for tok in shared_tokens:
            sim_score += 8
            if tok not in [k for _, k in shared_concepts]:
                shared_concepts.append((8, tok))
        
        if sim_score <= 0:
            continue
            
        # Prefer cross-book connections so the user discovers parallel teachings across the library
        if cand["bookId"] != rec["bookId"]:
            sim_score = int(sim_score * 1.25) + 4
            
        shared_concepts.sort(reverse=True)
        top_reasons = [k for _, k in shared_concepts[:3]]
        scored_candidates.append({
            "score": sim_score,
            "bookId": cand["bookId"],
            "bookTitle": cand["bookTitle"],
            "chapterId": cand["chapterId"],
            "chapterTitle": cand["chapterTitle"],
            "readingMinutes": cand["readingMinutes"],
            "sharedTopics": top_reasons
        })
    
    scored_candidates.sort(key=lambda x: (-x["score"], x["bookId"], x["chapterId"]))
    
    # Pick up to 4 diverse related chapters (at most 2 from the same book)
    selected = []
    per_book_count = {}
    for sc in scored_candidates:
        b_id = sc["bookId"]
        if per_book_count.get(b_id, 0) >= 2:
            continue
        selected.append({
            "bookId": sc["bookId"],
            "bookTitle": sc["bookTitle"],
            "chapterId": sc["chapterId"],
            "chapterTitle": sc["chapterTitle"],
            "readingMinutes": sc["readingMinutes"],
            "sharedTopics": sc["sharedTopics"]
        })
        per_book_count[b_id] = per_book_count.get(b_id, 0) + 1
        if len(selected) >= 4:
            break
            
    rec["ref"]["relatedChapters"] = selected

for bid, chaps in books_chapters_map.items():
    bf = f"data/book_{bid}.json"
    json.dump(chaps, open(bf, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"Enriched all {len(all_chapters_records)} chapters with smart relatedChapters.")


