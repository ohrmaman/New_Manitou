import asyncio
import json
import os
import re
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

catalog_path = '/Users/ormaman/New_Manitou/data/catalog.json'
with open(catalog_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# Ensure Book 25 is in catalog
if not any(b['id'] == 25 or 'sodtoladot10' in b.get('link', '') for b in catalog):
    catalog.append({
        "id": 25,
        "title": "סוד מדרש התולדות 10",
        "category": "history",
        "categoryLabel": "היסטוריה ומדרש",
        "description": "חלק עשירי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        "link": "https://manitou.org.il/arcive/sfarim/sodtoladot10",
        "imgUrl": "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot10.jpg",
        "design": "cover-design-1"
    })
    with open(catalog_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    print("Added Book 25 (סוד מדרש התולדות 10) to catalog.json")

os.makedirs('/Users/ormaman/New_Manitou/data/pdfs', exist_ok=True)

async def goto_with_retry(page, url, retries=3):
    for attempt in range(retries):
        try:
            await page.goto(url, timeout=60000, wait_until='domcontentloaded')
            return True
        except Exception as e:
            print(f"    Retry {attempt+1}/{retries} for {url}: {e}")
            await asyncio.sleep(2)
    return False

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("Logging in...")
        await goto_with_retry(page, "https://manitou.org.il/arcive/sfarim")
        await page.wait_for_load_state('networkidle')
        
        try:
            inputs = await page.query_selector_all('input')
            for i in inputs:
                name = await i.get_attribute('name')
                if name and 'username' in name.lower():
                    await i.fill('0507682931')
                elif name and 'password' in name.lower():
                    await i.fill('0507682931')
            
            buttons = await page.query_selector_all('button, input[type="submit"]')
            for b in buttons:
                text = await b.inner_text()
                val = await b.get_attribute('value')
                if (text and 'כניסה' in text) or (val and 'כניסה' in val):
                    await b.click()
                    break
            
            await page.wait_for_load_state('networkidle')
            print("Login successful.")
        except Exception as e:
            print("Login error or already logged in:", e)

        summary_report = []

        for book in catalog:
            book_id = book['id']
            index_url = book['link']
            
            if not index_url.startswith('https://manitou.org.il/arcive/sfarim'):
                continue
                
            print(f"\n==========================================")
            print(f"Scraping Book ID {book_id}: {book['title']} ({index_url})")
            if not await goto_with_retry(page, index_url):
                print(f"Failed to load {index_url}")
                continue
                
            html = await page.content()
            soup = BeautifulSoup(html, 'html.parser')
            
            chapters_data = []
            links = soup.find_all('a')
            
            chapter_urls = []
            chapter_titles = {}
            pdf_urls = {}
            
            for link in links:
                href = link.get('href')
                text = link.get_text(strip=True)
                
                if not href:
                    continue
                    
                if not href.startswith('http'):
                    href = 'https://manitou.org.il' + href
                
                if index_url in href and href != index_url and '?' not in href:
                    if '/file' in href or 'הורדה' in text:
                        base_chap = href.replace('/file', '')
                        pdf_urls[base_chap] = href
                    elif 'המשך קריאה' in text or 'קרא עוד' in text:
                        if href not in chapter_urls:
                            chapter_urls.append(href)
                    else:
                        if '#' not in href and 'pdf' not in text.lower():
                            if href not in chapter_urls:
                                chapter_urls.append(href)
                            if href not in chapter_titles or len(text) > len(chapter_titles[href]):
                                chapter_titles[href] = text
            
            unique_chapters = list(dict.fromkeys(chapter_urls))
            print(f"Found {len(unique_chapters)} chapters on index page.")
            
            # Load old chapters to compare
            book_json_path = f'/Users/ormaman/New_Manitou/data/book_{book_id}.json'
            old_chapters = []
            if os.path.exists(book_json_path):
                try:
                    with open(book_json_path, 'r', encoding='utf-8') as f:
                        old_chapters = json.load(f)
                except:
                    pass
            
            for i, chap_url in enumerate(unique_chapters):
                chap_num = i + 1
                print(f"  [{chap_num}/{len(unique_chapters)}] Fetching: {chap_url}")
                if not await goto_with_retry(page, chap_url):
                    print(f"  Failed chapter {chap_url}")
                    continue
                    
                chap_html = await page.content()
                chap_soup = BeautifulSoup(chap_html, 'html.parser')
                
                article = chap_soup.find('div', class_='item-page') or chap_soup.find('article') or chap_soup.find('main')
                if article:
                    for s in article.select('script, button, .btn, .print-icon, .email-icon'):
                        s.decompose()
                    text_content = article.decode_contents()
                else:
                    text_content = "<p>לא ניתן היה לחלץ את הטקסט באופן אוטומטי.</p>"
                    
                title = chapter_titles.get(chap_url, f"פרק {chap_num}")
                pdf = pdf_urls.get(chap_url, "")
                
                # Check if chapter page itself has a /file download link if pdf wasn't on index
                if not pdf:
                    dl_link = chap_soup.select_one('a.docman_track_download, a[href$="/file"]')
                    if dl_link and dl_link.get('href'):
                        dl_href = dl_link.get('href')
                        if not dl_href.startswith('http'):
                            dl_href = 'https://manitou.org.il' + dl_href
                        pdf = dl_href

                local_pdf_path = f"data/pdfs/book_{book_id}_chap_{chap_num}.pdf"
                abs_pdf_path = f"/Users/ormaman/New_Manitou/{local_pdf_path}"
                
                chap_obj = {
                    "id": chap_num,
                    "title": title,
                    "text": text_content,
                    "pdf_url": pdf
                }
                
                if pdf:
                    # Download PDF if missing or if chapter ordering shifted
                    need_download = not os.path.exists(abs_pdf_path)
                    if not need_download and i < len(old_chapters):
                        if old_chapters[i].get('pdf_url') != pdf:
                            need_download = True
                    if need_download:
                        try:
                            req = await context.request.get(pdf, timeout=60000)
                            if req.status == 200:
                                body = await req.body()
                                with open(abs_pdf_path, 'wb') as pf:
                                    pf.write(body)
                                print(f"    Downloaded PDF -> {local_pdf_path}")
                        except Exception as e:
                            print(f"    PDF download error for {pdf}: {e}")
                    if os.path.exists(abs_pdf_path):
                        chap_obj["local_pdf"] = local_pdf_path
                        
                chapters_data.append(chap_obj)
                
            with open(book_json_path, 'w', encoding='utf-8') as f:
                json.dump(chapters_data, f, ensure_ascii=False, indent=2)
                
            summary_report.append({
                "book_id": book_id,
                "title": book['title'],
                "old_count": len(old_chapters),
                "new_count": len(chapters_data)
            })
            print(f"Saved {book_json_path} ({len(old_chapters)} -> {len(chapters_data)} chapters)")

        print("\n=== SUMMARY REPORT ===")
        for r in summary_report:
            diff_str = f" (+{r['new_count'] - r['old_count']})" if r['new_count'] != r['old_count'] else ""
            print(f"Book {r['book_id']} ({r['title']}): {r['old_count']} -> {r['new_count']} chapters{diff_str}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
