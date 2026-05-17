import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print("Navigating to login...")
        await page.goto("https://manitou.org.il/arcive/sfarim")
        
        # Fill login
        try:
            print("Trying to log in...")
            # Look for username input
            inputs = await page.query_selector_all('input')
            for i in inputs:
                name = await i.get_attribute('name')
                if name and 'username' in name.lower():
                    await i.fill('0507682931')
                elif name and 'password' in name.lower():
                    await i.fill('0507682931')
            
            # Find submit button
            buttons = await page.query_selector_all('button, input[type="submit"]')
            for b in buttons:
                text = await b.inner_text()
                val = await b.get_attribute('value')
                if (text and 'כניסה' in text) or (val and 'כניסה' in val) or (text and 'Log in' in text):
                    await b.click()
                    break
            
            await page.wait_for_load_state('networkidle')
            print("Login complete.")
        except Exception as e:
            print("Login error or not needed:", e)
            
        print("Navigating to book index...")
        await page.goto("https://manitou.org.il/arcive/sfarim/masped-1")
        await page.wait_for_load_state('networkidle')
        
        html = await page.content()
        with open("book_index.html", "w") as f:
            f.write(html)
            
        print("Done. HTML saved to book_index.html")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
