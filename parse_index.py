import sys
from bs4 import BeautifulSoup

with open('book_index.html', 'r') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

links = soup.find_all('a')
for link in links:
    href = link.get('href')
    text = link.get_text(strip=True)
    if href and '/arcive/sfarim' in href and text:
        print(f"Text: {text} | Href: {href}")
