import sys
import re

html_path = '/Users/ormaman/New_Manitou/index.html'
js_path = '/Users/ormaman/New_Manitou/script.js'

# 1. Update HTML: Reader Mode Header
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

new_reader_header = """
        <div class="reader-header" style="padding: 1rem 2rem;">
            <button class="btn btn-primary btn-sm" id="backToLibrary" style="display: flex; align-items: center; gap: 8px; border-radius: 20px; padding: 0.5rem 1rem; border: none; cursor: pointer; background: var(--accent); color: var(--primary-bg);">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                חזור לספרייה (ראשי)
            </button>
            <div class="reader-title-area">
                <span class="reader-book-title" id="readerBookTitle" style="font-weight:bold;">שם הספר</span>
                <span class="reader-chapter-title" id="readerChapterTitle">פרק...</span>
            </div>
            <div class="reader-actions" style="display: flex; gap: 10px;">
                <button class="btn btn-secondary btn-sm" id="downloadPdfBtn" style="display: flex; align-items: center; gap: 8px; border-radius: 20px; padding: 0.5rem 1rem; cursor: pointer;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    הורד PDF
                </button>
                <button class="btn btn-secondary btn-sm" id="toggleTheme" style="display: flex; align-items: center; gap: 8px; border-radius: 20px; padding: 0.5rem 1rem; cursor: pointer; background: var(--secondary-bg); color: var(--text-main); border: 1px solid var(--border);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    <span id="readerThemeText">מצב לילה</span>
                </button>
            </div>
        </div>
"""

# Replace the reader-header
html = re.sub(r'<div class="reader-header">.*?</div>\n        <div class="reader-layout">', new_reader_header.strip() + '\n        <div class="reader-layout">', html, flags=re.DOTALL)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)


# 2. Update JS: Sync Reader theme toggle to Global theme toggle
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# First replace the old toggle logic inside openReader/initApp (wherever toggleThemeBtn listener is)
old_reader_theme = """    // Toggle Light/Dark Theme in Reader
    toggleThemeBtn.addEventListener('click', () => {
        readerMode.classList.toggle('light-theme');
    });"""

new_reader_theme = """    // Toggle Light/Dark Theme in Reader
    toggleThemeBtn.addEventListener('click', () => {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
        updateThemeBtnText();
    });"""

js = js.replace(old_reader_theme, new_reader_theme)

# Update updateThemeBtnText function to update both nav and reader text
old_update = """    function updateThemeBtnText() {
        if(navThemeText) {
            navThemeText.textContent = document.body.getAttribute('data-theme') === 'dark' ? 'מצב יום' : 'מצב לילה';
        }
    }"""

new_update = """    function updateThemeBtnText() {
        const text = document.body.getAttribute('data-theme') === 'dark' ? 'מצב יום' : 'מצב לילה';
        if (document.getElementById('navThemeText')) document.getElementById('navThemeText').textContent = text;
        if (document.getElementById('readerThemeText')) document.getElementById('readerThemeText').textContent = text;
    }"""

js = js.replace(old_update, new_update)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)

print("Fixed Reader Mode header and dark mode sync.")
