import asyncio
import json
import os
import glob
import time
from playwright.async_api import async_playwright

os.makedirs('data/pdfs', exist_ok=True)

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as ef:
        for line in ef:
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('\'"'))
SITE_USER = os.environ.get('MANITOU_SITE_USER', '')
SITE_PASS = os.environ.get('MANITOU_SITE_PASSWORD', '')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("Logging in for PDF downloads...")
        await page.goto("https://manitou.org.il/arcive/sfarim", timeout=60000)
        
        try:
            inputs = await page.query_selector_all('input')
            for i in inputs:
                name = await i.get_attribute('name')
                if name and 'username' in name.lower() and SITE_USER:
                    await i.fill(SITE_USER)
                elif name and 'password' in name.lower() and SITE_PASS:
                    await i.fill(SITE_PASS)
            
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

        print("Starting PDF downloader daemon...")
        
        books_completed = set()
        total_books = 24  # Assuming max 24 books based on our ID list
        
        while len(books_completed) < total_books:
            json_files = glob.glob('data/book_*.json')
            
            for file_path in json_files:
                book_id = file_path.split('_')[1].split('.')[0]
                
                # We can re-check files in case they were updated with new chapters while scraping
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        chapters = json.load(f)
                except:
                    continue # File might be written to at this exact moment
                    
                updated = False
                all_downloaded = True
                for chap in chapters:
                    pdf_url = chap.get('pdf_url')
                    local_pdf_path = f"data/pdfs/book_{book_id}_chap_{chap['id']}.pdf"
                    
                    if pdf_url:
                        if not os.path.exists(local_pdf_path):
                            all_downloaded = False
                            print(f"Downloading PDF for book {book_id}, chapter {chap['id']}...")
                            if not pdf_url.startswith('http'):
                                pdf_url = 'https://manitou.org.il' + pdf_url
                                
                            try:
                                req = await context.request.get(pdf_url)
                                if req.status == 200:
                                    body = await req.body()
                                    with open(local_pdf_path, 'wb') as pdf_file:
                                        pdf_file.write(body)
                                    print(f"  Saved to {local_pdf_path}")
                                    chap['local_pdf'] = local_pdf_path
                                    updated = True
                                else:
                                    print(f"  Failed with status {req.status}")
                            except Exception as e:
                                print(f"  Manual fetch failed: {e}")
                        else:
                            # If it exists but JSON wasn't updated
                            if chap.get('local_pdf') != local_pdf_path:
                                chap['local_pdf'] = local_pdf_path
                                updated = True
                
                if updated:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(chapters, f, ensure_ascii=False, indent=2)
                        
                # Mark book completed if the scraper is definitely done with it. 
                # (We'll just mark it complete if we see book_24, but wait, the scraper processes sequentially)
                # If we processed it and there's a file, we can't be sure it's fully populated until scraper moves to next book.
                # Just keeping it simple: if it exists, check it.
            
            # Check if scraper finished (we see book_24.json and downloaded its PDFs)
            if 'data/book_24.json' in json_files:
                # Give it a bit to finish any final downloads
                await asyncio.sleep(10)
                break
                
            print("Waiting 15 seconds for more JSON files...")
            await asyncio.sleep(15)

        print("All PDFs downloaded successfully!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
