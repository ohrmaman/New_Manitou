import asyncio
import json
import os
import re
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

# The full list of books we need to scrape
books = [
    {"id": 1, "link": "https://manitou.org.il/joomlatools-files/docman-images/mamarim1%20%281%29.jpg"}, # Not a real book index
    {"id": 2, "link": "https://manitou.org.il/arcive/sfarim/masped-1"},
    {"id": 3, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot1"},
    {"id": 4, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot2"},
    {"id": 5, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot3"},
    {"id": 6, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot4"},
    {"id": 7, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot5"},
    {"id": 8, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot6"},
    {"id": 9, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot7"},
    {"id": 10, "link": "https://manitou.org.il/arcive/sfarim/leshemshamaim-sod8"},
    {"id": 11, "link": "https://manitou.org.il/arcive/sfarim/sodtoladot9"},
    {"id": 12, "link": "https://manitou.org.il/arcive/sfarim/sheareidima1"},
    {"id": 13, "link": "https://manitou.org.il/arcive/sfarim/sheareidima2"},
    {"id": 14, "link": "https://manitou.org.il/arcive/sfarim/sheareidima-c"},
    {"id": 15, "link": "https://manitou.org.il/arcive/sfarim/sodleshonkodesh1"},
    {"id": 16, "link": "https://manitou.org.il/arcive/sfarim/sodleshonkodesh2"},
    {"id": 17, "link": "https://manitou.org.il/arcive/sfarim/sodivri1"},
    {"id": 18, "link": "https://manitou.org.il/arcive/sfarim/sodivri2"},
    {"id": 19, "link": "https://manitou.org.il/arcive/sfarim/kimitzionfr"},
    {"id": 20, "link": "https://manitou.org.il/arcive/sfarim/diburktav"},
    {"id": 21, "link": "https://manitou.org.il/arcive/sfarim/kojinsky"},
    {"id": 22, "link": "https://manitou.org.il/arcive/sfarim/mayanot-1"},
    {"id": 23, "link": "https://manitou.org.il/arcive/sfarim/moaadim-sefer"},
    {"id": 24, "link": "https://manitou.org.il/arcive/sfarim/kolhamoed"}
]

os.makedirs('data', exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print("Logging in...")
        await page.goto("https://manitou.org.il/arcive/sfarim", timeout=60000)
        
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

        for book in books:
            book_id = book['id']
            index_url = book['link']
            
            if not index_url.startswith('https://manitou.org.il/arcive/sfarim'):
                continue
                
            print(f"Scraping Book ID: {book_id}")
            try:
                await page.goto(index_url, timeout=30000)
                await page.wait_for_load_state('networkidle')
            except Exception as e:
                print(f"Failed to load {index_url}: {e}")
                continue
                
            html = await page.content()
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find all chapter links. We look for 'המשך קריאה' or the article titles.
            # Usually chapter links are inside the main content area.
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
                
                # Check if it's a chapter link (contains the book url path)
                if index_url in href and href != index_url:
                    if '/file' in href or 'הורדה' in text:
                        # It's a PDF link
                        base_chap = href.replace('/file', '')
                        pdf_urls[base_chap] = href
                    elif 'המשך קריאה' in text or 'קרא עוד' in text:
                        if href not in chapter_urls:
                            chapter_urls.append(href)
                    else:
                        # Might be the title link
                        if '#' not in href and 'pdf' not in text.lower():
                            if href not in chapter_urls:
                                chapter_urls.append(href)
                            if href not in chapter_titles or len(text) > len(chapter_titles[href]):
                                chapter_titles[href] = text
            
            # Remove duplicates while preserving order
            unique_chapters = list(dict.fromkeys(chapter_urls))
            
            print(f"Found {len(unique_chapters)} chapters.")
            
            for i, chap_url in enumerate(unique_chapters):
                print(f"  Fetching chapter {i+1}: {chap_url}")
                try:
                    await page.goto(chap_url, timeout=30000)
                    await page.wait_for_load_state('networkidle')
                    chap_html = await page.content()
                    chap_soup = BeautifulSoup(chap_html, 'html.parser')
                    
                    # The text is usually inside an item-page or article block
                    article = chap_soup.find('div', class_='item-page') or chap_soup.find('article') or chap_soup.find('main')
                    if article:
                        # Extract clean HTML or text
                        # Remove scripts and buttons
                        for s in article.select('script, button, .btn, .print-icon, .email-icon'):
                            s.decompose()
                        text_content = article.decode_contents()
                    else:
                        text_content = "<p>לא ניתן היה לחלץ את הטקסט באופן אוטומטי.</p>"
                        
                    title = chapter_titles.get(chap_url, f"פרק {i+1}")
                    pdf = pdf_urls.get(chap_url, "")
                    
                    chapters_data.append({
                        "id": i+1,
                        "title": title,
                        "text": text_content,
                        "pdf_url": pdf
                    })
                except Exception as e:
                    print(f"  Failed chapter {chap_url}: {e}")
                    
            # Save book data
            with open(f'data/book_{book_id}.json', 'w', encoding='utf-8') as f:
                json.dump(chapters_data, f, ensure_ascii=False, indent=2)
                
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
