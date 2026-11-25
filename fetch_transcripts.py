import concurrent.futures
import hashlib
import http.cookiejar
import json
import os
import re
import ssl
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from bs4 import BeautifulSoup

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

BASE_DIR = '/Users/ormaman/New_Manitou'
DATA_DIR = os.path.join(BASE_DIR, 'data')
TRANSCRIPTS_DIR = os.path.join(DATA_DIR, 'transcripts')
PDFS_CACHE_DIR = os.path.join(TRANSCRIPTS_DIR, 'pdfs')
LIB_INNER_CACHE_PATH = os.path.join(TRANSCRIPTS_DIR, 'library_inner_cache.json')
PDF_TEXT_CACHE_PATH = os.path.join(TRANSCRIPTS_DIR, 'pdf_text_cache.json')
EXTRACTOR_JS = os.path.join(BASE_DIR, 'extract_pdf_text.js')

os.makedirs(PDFS_CACHE_DIR, exist_ok=True)

TFILE_PDF_BOOKLETS = [
    ("נתיב התורה למהר״ל — חוברת תמלול שיעורים מלאה", "מהר״ל • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/nativpatuach.pdf"),
    ("מבוא לתפילה ותפילת שמונה עשרה — חוברת תמלול מלאה", "תפילה • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/mavotfilatimlul.pdf"),
    ("מהפכת הזהות העברית — חוברת תמלול שיעורים מלאה", "זהות עברית • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/mahapechatimlul.pdf"),
    ("אומנות עברית — תמלול שיעורי מניטו", "מחשבת ישראל • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/omanutivrit.pdf"),
    ("סיפור הזהות (1993) — חוברת תמלול מלאה", "זהות ותולדות • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/sipurzehut1993.pdf"),
    ("נבואה, בחירה חופשית וימות המשיח — חוברת תמלול מלאה", "גאולה ומשיחיות • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/nevuabhiramashiach.timlul.pdf"),
    ("קריאה בכתבי יעקב גורדין — חוברת תמלול שיעורים", "פילוסופיה וקבלה • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/kriagordin.pdf"),
    ("שיעורי מניטו לחנוכה (נר מצווה למהר״ל ומאמרי הראי״ה) — חוברת תמלול", "חגים ומועדים • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/manitouhanuka.2.71.pdf"),
    ("ראש השנה ופסח במשנת מניטו — חוברת תמלול שיעורים", "חגים ומועדים • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/roshhashanapesach.pdf"),
    ("להתחיל מבראשית — חוברת תמלול כל סדרת השיעורים", "ספר בראשית • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/mathilimbereshit.pdf"),
    ("שיעורים בכתבי הרב קוק ואורות הקודש — חוברת תמלול מלאה", "הרב קוק • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/kitveikuk-b.pdf"),
    ("דרך חיים למהר״ל (פרקי אבות) — חוברת תמלול הסדרה", "מהר״ל • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/dhaimtimlul.pdf"),
    ("הראיון האחרון עם הרב יהודא לאון אשכנזי (מניטו) — תמלול מלא", "ביוגרפיה וראיונות • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/reaiontimlul.pdf"),
    ("גבורות ה׳ למהר״ל (פרק ל״א: הצעקה של פרעה) — חוברת תמלול", "מהר״ל • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/gvurot31timlul.pdf"),
    ("מקורות על התשובה (שערי תשובה לרבינו יונה) — חוברת תמלול", "תשובה ומוסר • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/mekorothsuva.pdf"),
    ("לימוד על ראיון של הרצי״ה קוק — חוברת תמלול שיעור", "הרב קוק • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/limudreaionratzia.pdf"),
    ("שיחה על הרב צבי יהודה קוק (הרצי״ה) — חוברת תמלול", "הרב קוק • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/siharatzia1.pdf"),
    ("הגדה של פסח בעולת ראיה להראי״ה קוק — חוברת תמלול שיעורים", "חגים ומועדים • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/timlulpesacholatreaia.pdf"),
    ("מדרשים על מתן תורה — חוברת תמלול שיעורי מניטו", "חגים ומועדים • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/matantoratimlul.pdf"),
    ("שיעורי מניטו לפורים — חוברת תמלול מלאה", "חגים ומועדים • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/purimtimlul.pdf"),
    ("שורש ההכרה המוסרית (תמלול ותרגום מצרפתית)", "מוסר ופילוסופיה • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/shoreshhakaramusar.pdf"),
    ("שיעורי ימים נוראים — חוברת תמלול מלאה", "חגים ומועדים • תמלולי שיעורים", "https://manitou.org.il/joomlatools-files/tfile/yamimnoraim.pdf")
]

MANITOU_ARCHIVE_ROOTS = [
    ("https://manitou.org.il/arcive/timlul", "תמלולי שיעורים"),
    ("https://manitou.org.il/arcive/mamarim", "מאמרים ומחקרים"),
    ("https://manitou.org.il/arcive/mamarim/mamarim-manitou", "מאמרי מניטו"),
    ("https://manitou.org.il/arcive/mamarim/mamarimhitzoni/mamarim-manitou-2", "מחקרים על משנת מניטו")
]


def normalize_url(url):
    parsed = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe='/+-_.,~%=:@')
    query = urllib.parse.quote_plus(urllib.parse.unquote_plus(parsed.query), safe='=&+-_.,~%:@/')
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, query, ''))


def create_manitou_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPSHandler(context=ctx)
    )
    opener.addheaders = list(HEADERS.items())

    # Attempt optional Joomla login on manitou.org.il so protected /file PDFs download cleanly
    try:
        resp = opener.open(normalize_url("https://manitou.org.il/arcive/sfarim"), timeout=20)
        html = resp.read().decode('utf-8', errors='replace')
        soup = BeautifulSoup(html, 'html.parser')
        form = soup.find('form', id='login-form') or soup.find('form')
        if form:
            payload = {}
            for inp in form.find_all('input'):
                name = inp.get('name')
                if not name:
                    continue
                if 'username' in name.lower():
                    payload[name] = '0507682931'
                elif 'password' in name.lower():
                    payload[name] = '0507682931'
                else:
                    payload[name] = inp.get('value', '')
            action = urllib.parse.urljoin("https://manitou.org.il/arcive/sfarim", form.get('action') or '')
            data = urllib.parse.urlencode(payload).encode('utf-8')
            opener.open(normalize_url(action), data=data, timeout=20).read()
    except Exception:
        pass
    cookie_str = '; '.join(f"{c.name}={c.value}" for c in cj)
    opener._cookie_header = cookie_str
    return opener


def fetch_html_with_opener(opener, url, timeout=25):
    safe_url = normalize_url(url)
    with opener.open(safe_url, timeout=timeout) as resp:
        return resp.read().decode('utf-8', errors='replace')


def fetch_url(url, timeout=25):
    safe_url = normalize_url(url)
    req = urllib.request.Request(safe_url, headers=HEADERS)
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
        return resp.read().decode('utf-8', errors='replace')


def download_pdf_cached(opener, pdf_url, slug_prefix='tr'):
    if not pdf_url:
        return None
    url_hash = hashlib.md5(pdf_url.encode('utf-8')).hexdigest()[:12]
    base_name = os.path.basename(urllib.parse.unquote(urllib.parse.urlsplit(pdf_url).path))
    if not base_name.lower().endswith('.pdf'):
        base_name = f"{slug_prefix}_{url_hash}.pdf"
    else:
        safe_base = re.sub(r'[^a-zA-Z0-9._-]', '_', base_name)
        base_name = f"{slug_prefix}_{url_hash}_{safe_base}"

    abs_path = os.path.join(PDFS_CACHE_DIR, base_name)
    rel_path = f"data/transcripts/pdfs/{base_name}"

    if os.path.exists(abs_path) and os.path.getsize(abs_path) > 1024:
        return abs_path, rel_path

    try:
        safe_url = normalize_url(pdf_url)
        req_headers = dict(HEADERS)
        cookie_hdr = getattr(opener, '_cookie_header', '')
        if cookie_hdr and 'manitou.org.il' in safe_url:
            req_headers['Cookie'] = cookie_hdr
        req = urllib.request.Request(safe_url, headers=req_headers)
        with urllib.request.urlopen(req, context=ctx, timeout=35) as resp:
            ctype = (resp.headers.get('Content-Type') or '').lower()
            body = resp.read()
            if body[:4] == b'%PDF' or ('pdf' in ctype and len(body) > 1024):
                with open(abs_path, 'wb') as f:
                    f.write(body)
                return abs_path, rel_path
    except Exception as e:
        print(f"    [PDF warn] {pdf_url}: {e}")
    return None


def batch_extract_pdfs_via_node(pdf_jobs):
    """
    pdf_jobs: list of (job_id, abs_pdf_path)
    Uses disk cache + extract_pdf_text.js for fast, properly spaced Hebrew text extraction.
    """
    cache = {}
    if os.path.exists(PDF_TEXT_CACHE_PATH):
        try:
            cache = json.load(open(PDF_TEXT_CACHE_PATH, encoding='utf-8'))
        except Exception:
            cache = {}

    results = {}
    missing_manifest = []
    for job_id, abs_path in pdf_jobs:
        if not abs_path or not os.path.exists(abs_path):
            continue
        cache_key = f"{os.path.basename(abs_path)}:{os.path.getsize(abs_path)}"
        if cache_key in cache and cache[cache_key].get('wordCount', 0) > 5:
            results[job_id] = cache[cache_key]
        else:
            missing_manifest.append({'id': job_id, 'pdfPath': abs_path, 'cacheKey': cache_key})

    if missing_manifest and os.path.exists(EXTRACTOR_JS):
        print(f"  [PDF->Text] Extracting Hebrew free text from {len(missing_manifest)} PDFs via Node PDFParse...")
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as mf:
            json.dump(missing_manifest, mf, ensure_ascii=False)
            manifest_path = mf.name
        out_path = manifest_path + '.out.json'
        try:
            subprocess.run(['node', EXTRACTOR_JS, '--batch', manifest_path, out_path], check=True, timeout=300)
            if os.path.exists(out_path):
                extracted = json.load(open(out_path, encoding='utf-8'))
                for m in missing_manifest:
                    jid = m['id']
                    ckey = m['cacheKey']
                    if jid in extracted and extracted[jid].get('plainText'):
                        results[jid] = extracted[jid]
                        cache[ckey] = extracted[jid]
                with open(PDF_TEXT_CACHE_PATH, 'w', encoding='utf-8') as cf:
                    json.dump(cache, cf, ensure_ascii=False)
        except Exception as e:
            print(f"  [PDF->Text warn] Batch extraction error: {e}")
        finally:
            for p in (manifest_path, out_path):
                if os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

    return results


def clean_article_html_and_text(soup_node):
    if not soup_node:
        return '', ''
    clone = BeautifulSoup(str(soup_node), 'html.parser')
    for junk in clone.select('script, style, .mn-toc, .koowa_header, .docman_download, [id^="komento"], [class*="komento"], #section-kmt, .kmt-list, .buttonheading, .icons, .print-icon, .email-icon, nav, form'):
        junk.decompose()
    html_str = clone.decode_contents().strip()
    plain = clone.get_text('\n', strip=True)
    plain = re.sub(r'\n{3,}', '\n\n', plain).strip()
    return html_str, plain


def scrape_manitou_org_articles_and_booklets(opener, existing_manitou_items):
    print('[1/3] Processing manitou.org.il booklets, transcripts & articles (with full PDF free-text extraction)...')
    discovered_urls = {}

    # 1. Discover articles across manitou.org.il archive roots
    for root_url, default_cat in MANITOU_ARCHIVE_ROOTS:
        try:
            html = fetch_html_with_opener(opener, root_url, timeout=25)
            soup = BeautifulSoup(html, 'html.parser')
            for a in soup.find_all('a', href=True):
                href = a['href'].strip()
                if not href or href.startswith('#') or 'javascript:' in href:
                    continue
                full = urllib.parse.urljoin('https://manitou.org.il', href)
                if not full.startswith('https://manitou.org.il/arcive/'):
                    continue
                if '/sfarim' in full or '?' in full or full.endswith('/file'):
                    continue
                if full.rstrip('/') in [r[0].rstrip('/') for r in MANITOU_ARCHIVE_ROOTS]:
                    continue
                title = a.get_text(' ', strip=True)
                if len(title) >= 4 and full not in discovered_urls:
                    discovered_urls[full] = (title, default_cat)
        except Exception as e:
            print(f"  [manitou.org.il warn] {root_url}: {e}")

    # Merge with previously known manitou.org.il items so nothing is ever lost
    by_url = {it.get('sourceUrl'): dict(it) for it in existing_manitou_items if it.get('sourceUrl')}

    for url, (disc_title, disc_cat) in discovered_urls.items():
        existing = by_url.get(url)
        if existing and len((existing.get('plainText') or '').strip()) >= 400:
            continue
        try:
            html = fetch_html_with_opener(opener, url, timeout=25)
            soup = BeautifulSoup(html, 'html.parser')
            h1 = soup.select_one('h1, h2.item-title, .page-header h2, .koowa_header__title')
            title = h1.get_text(' ', strip=True) if h1 else disc_title
            body_node = (
                soup.select_one('[itemprop="articleBody"]')
                or soup.select_one('[itemprop="description"]')
                or soup.select_one('.item-page')
                or soup.select_one('.docman_document')
            )
            clean_html, plain = clean_article_html_and_text(body_node)
            pdf_link = ''
            dl_el = soup.select_one('a.docman_track_download[href], a[href$="/file"], a[href$=".pdf"]')
            if dl_el:
                pdf_link = urllib.parse.urljoin('https://manitou.org.il', dl_el['href'])

            by_url[url] = {
                'id': (existing or {}).get('id') or f"man_{abs(hash(url)) % 100000}",
                'sourceSite': 'manitou.org.il',
                'sourceUrl': url,
                'title': title or disc_title,
                'category': (existing or {}).get('category') or disc_cat,
                'pdfUrl': pdf_link or (existing or {}).get('pdfUrl', ''),
                'audioUrl': (existing or {}).get('audioUrl', ''),
                'html': clean_html,
                'plainText': plain
            }
        except Exception:
            pass

    # Build the 22 PDF booklets list
    booklet_items = []
    for idx, (btitle, bcat, bpdf) in enumerate(TFILE_PDF_BOOKLETS, start=1):
        booklet_items.append({
            'id': f'man_booklet_{idx}',
            'sourceSite': 'manitou.org.il',
            'sourceUrl': 'https://manitou.org.il/arcive/timlul/2868-timlulimpatuach',
            'title': btitle,
            'category': bcat,
            'pdfUrl': bpdf,
            'origPdfUrl': bpdf,
            'audioUrl': '',
            'html': '',
            'plainText': ''
        })

    all_man_items = booklet_items + list(by_url.values())

    # Identify every item whose plainText is short/missing (< 350 chars) and has a PDF URL -> download & extract full text!
    pdf_download_targets = []
    for item in all_man_items:
        plain_len = len((item.get('plainText') or '').strip())
        pdf_u = item.get('origPdfUrl') or item.get('pdfUrl') or ''
        # Skip boilerplate stub text we generated previously
        if 'חוברת תמלול מלאה להורדה בפורמט PDF' in (item.get('plainText') or ''):
            plain_len = 0
        if plain_len < 350 and pdf_u.startswith('http'):
            pdf_download_targets.append(item)

    print(f"  Downloading/verifying {len(pdf_download_targets)} PDFs from manitou.org.il for full-text extraction...")
    pdf_jobs = []

    # Separate direct .pdf URLs (fast via urllib) from Joomla Docman /file URLs (require Playwright login session)
    direct_pdf_targets = [it for it in pdf_download_targets if not (it.get('origPdfUrl') or it.get('pdfUrl') or '').endswith('/file')]
    docman_file_targets = [it for it in pdf_download_targets if (it.get('origPdfUrl') or it.get('pdfUrl') or '').endswith('/file')]

    def dl_worker(it):
        u = it.get('origPdfUrl') or it.get('pdfUrl')
        res = download_pdf_cached(opener, u, slug_prefix=str(it.get('id', 'man')))
        return it['id'], res

    if direct_pdf_targets:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            for item_id, dl_res in ex.map(dl_worker, direct_pdf_targets):
                if dl_res:
                    abs_p, rel_p = dl_res
                    pdf_jobs.append((item_id, abs_p))
                    for it in all_man_items:
                        if it['id'] == item_id:
                            it['localPdf'] = rel_p
                            it['pdfUrl'] = rel_p

    if docman_file_targets:
        # Check which docman /file PDFs are already cached locally first
        uncached_docman = []
        for it in docman_file_targets:
            u = it.get('origPdfUrl') or it.get('pdfUrl')
            url_hash = hashlib.md5(u.encode('utf-8')).hexdigest()[:12]
            base_name = f"{it.get('id', 'man')}_{url_hash}.pdf"
            abs_path = os.path.join(PDFS_CACHE_DIR, base_name)
            rel_path = f"data/transcripts/pdfs/{base_name}"
            if os.path.exists(abs_path) and os.path.getsize(abs_path) > 1024:
                pdf_jobs.append((it['id'], abs_path))
                it['localPdf'] = rel_path
                it['pdfUrl'] = rel_path
            else:
                uncached_docman.append((it, u, abs_path, rel_path))

        if uncached_docman:
            try:
                import asyncio
                from playwright.async_api import async_playwright

                async def download_docman_via_playwright(targets):
                    downloaded = []
                    async with async_playwright() as p:
                        browser = await p.chromium.launch(headless=True)
                        context = await browser.new_context()
                        page = await context.new_page()
                        await page.goto("https://manitou.org.il/arcive/sfarim", timeout=30000, wait_until='domcontentloaded')
                        for inp in await page.query_selector_all('input'):
                            nm = (await inp.get_attribute('name') or '').lower()
                            if 'username' in nm or 'password' in nm:
                                await inp.fill('0507682931')
                        for btn in await page.query_selector_all('button, input[type="submit"]'):
                            txt = (await btn.inner_text() if await btn.evaluate('el => el.tagName') == 'BUTTON' else '') or (await btn.get_attribute('value') or '')
                            if 'כניסה' in txt:
                                await btn.click()
                                await page.wait_for_load_state('domcontentloaded')
                                break

                        sem = asyncio.Semaphore(6)

                        async def fetch_one(it, u, abs_p, rel_p):
                            async with sem:
                                try:
                                    r = await context.request.get(u, timeout=15000)
                                    if r.status == 200:
                                        body = await r.body()
                                        if body[:4] == b'%PDF':
                                            with open(abs_p, 'wb') as f:
                                                f.write(body)
                                            return (it['id'], abs_p, rel_p)
                                except Exception:
                                    pass
                                return None

                        results = await asyncio.gather(*(fetch_one(it, u, abs_p, rel_p) for it, u, abs_p, rel_p in targets))
                        await browser.close()
                        return [x for x in results if x]

                print(f"  Using authenticated Playwright session for {len(uncached_docman)} Docman /file items...")
                pw_results = asyncio.run(download_docman_via_playwright(uncached_docman))
                print(f"  Downloaded {len(pw_results)} Docman PDFs via Playwright!")
                for item_id, abs_p, rel_p in pw_results:
                    pdf_jobs.append((item_id, abs_p))
                    for it in all_man_items:
                        if it['id'] == item_id:
                            it['localPdf'] = rel_p
                            it['pdfUrl'] = rel_p
            except Exception as pw_err:
                print(f"  [Playwright Docman info] {pw_err}")

    extracted_map = batch_extract_pdfs_via_node(pdf_jobs)

    enriched_man_items = []
    for it in all_man_items:
        iid = it['id']
        if iid in extracted_map and extracted_map[iid].get('plainText'):
            ext = extracted_map[iid]
            it['plainText'] = ext['plainText']
            pdf_badge_url = it.get('localPdf') or it.get('pdfUrl') or ''
            header_note = f'<div class="extracted-pdf-banner"><p>📄 <strong>טקסט מלא שחולץ אוטומטית מקובץ המקור</strong> ({ext.get("pageCount", 0)} עמודים) • <a href="{pdf_badge_url}" target="_blank" rel="noopener">לפתיחת קובץ ה-PDF המקורי לחץ כאן ↗</a></p></div>\n'
            it['html'] = header_note + ext['html']
            it['wordCount'] = ext['wordCount']
            it['readingMinutes'] = max(1, round(ext['wordCount'] / 150))
        else:
            plain = (it.get('plainText') or '').strip()
            # Filter out tiny junk test pages like "ניסיון" with no real content and no extracted PDF
            if it.get('title') == 'ניסיון' and len(plain) < 80:
                continue
            wc = len(plain.split()) if plain else 0
            it['wordCount'] = wc
            it['readingMinutes'] = max(1, round(wc / 150)) if wc > 0 else 1
        it['hasFullText'] = len((it.get('plainText') or '').strip()) >= 350
        enriched_man_items.append(it)

    return enriched_man_items


def scrape_all_library_lessons_with_inner_text(opener):
    """Crawl index pages of https://library.manitou.org.il/ AND fetch inner lesson pages for full transcript/source text."""
    print('[2/3] Crawling https://library.manitou.org.il/ index + inner lesson pages...')
    inner_cache = {}
    if os.path.exists(LIB_INNER_CACHE_PATH):
        try:
            inner_cache = json.load(open(LIB_INNER_CACHE_PATH, encoding='utf-8'))
        except Exception:
            inner_cache = {}

    page_urls = [f'https://library.manitou.org.il/?page={p}' for p in range(1, 44)]

    def parse_index_page(page_num_and_url):
        pnum, u = page_num_and_url
        try:
            html = fetch_url(u, timeout=25)
            soup = BeautifulSoup(html, 'html.parser')
            cards = soup.select('a.lesson-card')
            page_items = []
            for card in cards:
                href = (card.get('href') or '').strip()
                if not href:
                    continue
                full_url = urllib.parse.urljoin('https://library.manitou.org.il/', href)
                h2 = card.find('h2')
                title = h2.get_text(' ', strip=True) if h2 else 'שיעור'
                tag_el = card.select_one('.tag')
                cat = tag_el.get_text(' ', strip=True) if tag_el else 'ארכיון שיעורי מניטו'
                lang_el = card.select_one('.lesson-lang')
                lang = lang_el.get_text(' ', strip=True) if lang_el else 'he'
                date_el = card.select_one('.date')
                date_str = date_el.get_text(' ', strip=True) if date_el else ''
                sum_el = card.select_one('.lesson-summary')
                summary = sum_el.get_text(' ', strip=True) if sum_el else ''
                page_items.append((pnum, {
                    'sourceSite': 'library.manitou.org.il',
                    'sourceUrl': full_url,
                    'title': title,
                    'category': cat,
                    'language': lang,
                    'date': date_str,
                    'summary': summary
                }))
            return page_items
        except Exception as e:
            print(f'  Error on index page {pnum}: {e}')
            return []

    all_cards = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for res in ex.map(parse_index_page, enumerate(page_urls, start=1)):
            all_cards.extend(res)

    all_cards.sort(key=lambda x: x[0])
    seen = set()
    deduped = []
    for _, item in all_cards:
        if item['sourceUrl'] in seen:
            continue
        seen.add(item['sourceUrl'])
        item['id'] = f'lib_{len(deduped) + 1}'
        deduped.append(item)

    # Fetch inner lesson pages for items not yet in inner_cache
    uncached = [it for it in deduped if it['sourceUrl'] not in inner_cache]
    if uncached:
        print(f"  Fetching {len(uncached)} inner lesson pages from library.manitou.org.il...")

        def fetch_inner_lesson(it):
            u = it['sourceUrl']
            try:
                html = fetch_url(u, timeout=25)
                soup = BeautifulSoup(html, 'html.parser')
                audio_url = ''
                audio_el = soup.select_one('audio source[src], audio[src], a[href$=".mp3"]')
                if audio_el:
                    audio_url = urllib.parse.urljoin(u, audio_el.get('src') or audio_el.get('href') or '')

                pdf_url = ''
                pdf_el = soup.select_one('a[href$=".pdf"]')
                if pdf_el:
                    pdf_url = urllib.parse.urljoin(u, pdf_el.get('href') or '')

                # Extract transcript / content blocks inside the lesson page
                for junk in soup.select('script, style, nav, header.site-header, footer, .navbar, .breadcrumbs, .related-lessons, .share-buttons'):
                    junk.decompose()

                content_node = (
                    soup.select_one('.transcript-content, .lesson-transcript, .lesson-body, .lesson-content, article, main')
                    or soup.body
                )
                body_html, body_plain = clean_article_html_and_text(content_node)
                return u, {
                    'bodyHtml': body_html,
                    'bodyPlain': body_plain,
                    'audioUrl': audio_url,
                    'pdfUrl': pdf_url
                }
            except Exception:
                return u, None

        done_count = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
            for u, data in ex.map(fetch_inner_lesson, uncached):
                done_count += 1
                if data:
                    inner_cache[u] = data
                if done_count % 250 == 0:
                    print(f"    ... fetched {done_count}/{len(uncached)} inner lesson pages")
                    with open(LIB_INNER_CACHE_PATH, 'w', encoding='utf-8') as f:
                        json.dump(inner_cache, f, ensure_ascii=False)

        with open(LIB_INNER_CACHE_PATH, 'w', encoding='utf-8') as f:
            json.dump(inner_cache, f, ensure_ascii=False)

    # If any inner lesson has a PDF transcript and short HTML text, download & extract its PDF text too!
    lib_pdf_jobs = []
    for it in deduped:
        cached = inner_cache.get(it['sourceUrl']) or {}
        if cached.get('pdfUrl') and len((cached.get('bodyPlain') or '')) < 500:
            dl_res = download_pdf_cached(opener, cached['pdfUrl'], slug_prefix=it['id'])
            if dl_res:
                abs_p, rel_p = dl_res
                it['localPdf'] = rel_p
                lib_pdf_jobs.append((it['id'], abs_p))

    lib_extracted_pdfs = batch_extract_pdfs_via_node(lib_pdf_jobs) if lib_pdf_jobs else {}

    enriched_lib = []
    for it in deduped:
        cached = inner_cache.get(it['sourceUrl']) or {}
        lang_badge = {'he': 'עברית', 'fr': 'צרפתית (FR)', 'en': 'אנגלית (EN)'}.get(it['language'], it['language'])
        summary = it.get('summary') or ''
        body_plain = (cached.get('bodyPlain') or '').strip()
        body_html = (cached.get('bodyHtml') or '').strip()

        if it['id'] in lib_extracted_pdfs and lib_extracted_pdfs[it['id']].get('plainText'):
            ext = lib_extracted_pdfs[it['id']]
            body_plain = ext['plainText']
            body_html = ext['html']

        plain = body_plain if len(body_plain) > len(summary) else f"{it['title']}\n\n{summary}".strip()
        if not body_html or len(body_plain) < 120:
            body_html = f"""
                <div class="library-lesson-overview">
                    <p><strong>קטגוריה:</strong> {it['category']} &nbsp;|&nbsp; <strong>שפה:</strong> {lang_badge} {f"&nbsp;|&nbsp; <strong>תאריך:</strong> {it['date']}" if it.get('date') else ''}</p>
                    <p>{summary}</p>
                    <p><a href="{it['sourceUrl']}" target="_blank" rel="noopener">🔗 פתח את עמוד השיעור וההקלטה ב-library.manitou.org.il ↗</a></p>
                </div>
            """.strip()

        wc = max(1, len(plain.split()))
        enriched_lib.append({
            'id': it['id'],
            'sourceSite': 'library.manitou.org.il',
            'sourceUrl': it['sourceUrl'],
            'title': it['title'],
            'category': it['category'],
            'language': it['language'],
            'date': it.get('date', ''),
            'wordCount': wc,
            'readingMinutes': max(1, round(wc / 150)),
            'pdfUrl': it.get('localPdf') or cached.get('pdfUrl', ''),
            'audioUrl': cached.get('audioUrl', ''),
            'hasFullText': len(plain) >= 350,
            'html': body_html,
            'plainText': plain
        })

    return enriched_lib


def main():
    t0 = time.time()
    archive_path = os.path.join(DATA_DIR, 'transcripts_archive.json')
    existing_manitou_items = []
    existing_lib_items = []
    if os.path.exists(archive_path):
        try:
            old_data = json.load(open(archive_path, encoding='utf-8'))
            for it in old_data.get('items', []):
                if it.get('sourceSite') == 'manitou.org.il' and not str(it.get('id', '')).startswith('man_booklet_'):
                    existing_manitou_items.append(it)
                elif it.get('sourceSite') == 'library.manitou.org.il':
                    existing_lib_items.append(it)
        except Exception:
            pass

    opener = create_manitou_opener()
    man_items = scrape_manitou_org_articles_and_booklets(opener, existing_manitou_items)
    lib_items = scrape_all_library_lessons_with_inner_text(opener)
    if not lib_items and existing_lib_items:
        lib_items = existing_lib_items

    # Deduplicate items that share identical extracted content (e.g. multiple Joomla URLs pointing to same PDF)
    raw_combined = man_items + lib_items
    seen_fingerprints = set()
    all_items = []
    for r in raw_combined:
        plain = (r.get('plainText') or '').replace('\u00aa', 'נ').strip()
        r['plainText'] = plain
        if r.get('html'):
            r['html'] = r['html'].replace('\u00aa', 'נ')
        # Omit redundant bulky HTML when plainText already holds the full extracted PDF paragraphs (rendered cleanly in UI)
        if r.get('localPdf') and len(plain) > 1000:
            r['html'] = ''
        fp = hashlib.md5(plain[:2500].encode('utf-8')).hexdigest() if len(plain) >= 600 else f"url:{r.get('id')}:{r.get('sourceUrl')}"
        if fp in seen_fingerprints:
            continue
        seen_fingerprints.add(fp)
        all_items.append(r)

    # Sort: Full-text Hebrew transcripts & booklets FIRST (by word count / richness), then summaries/PDF-only
    all_items.sort(key=lambda r: (
        1 if r.get('hasFullText') else 0,
        1 if r.get('language', 'he') == 'he' else 0,
        min(r.get('wordCount', 0), 50000)
    ), reverse=True)

    full_text_count = sum(1 for r in all_items if r.get('hasFullText'))

    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump({
            'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'totalCount': len(all_items),
            'fullTextCount': full_text_count,
            'libraryCount': sum(1 for r in all_items if r.get('sourceSite') == 'library.manitou.org.il'),
            'manitouOrgCount': sum(1 for r in all_items if r.get('sourceSite') == 'manitou.org.il'),
            'items': all_items
        }, f, ensure_ascii=False, separators=(',', ':'))

    elapsed = round(time.time() - t0, 1)
    print(f'[3/3] DONE in {elapsed}s: Saved {len(all_items)} items ({full_text_count} with full free text!) to {archive_path}')


if __name__ == '__main__':
    main()
