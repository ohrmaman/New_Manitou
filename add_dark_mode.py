import sys
import re

html_path = '/Users/ormaman/New_Manitou/index.html'
css_path = '/Users/ormaman/New_Manitou/style.css'
js_path = '/Users/ormaman/New_Manitou/script.js'

# 1. Update HTML: Add a theme toggle button in the navbar
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

toggle_btn = """                <button class="icon-btn" id="mainThemeToggle" title="החלף מצב תצוגה">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </button>
"""
if 'id="mainThemeToggle"' not in html:
    html = html.replace('<span class="user-greeting">שלום אור</span>', '<span class="user-greeting">שלום אור</span>\n' + toggle_btn)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

# 2. Update CSS: Add dark theme tokens and fix hardcoded colors
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

dark_theme_tokens = """
[data-theme="dark"] {
    --primary-bg: #0f172a;
    --secondary-bg: #1e293b;
    --accent: #d4af37;
    --accent-light: #fef08a;
    --accent-dark: #b48e24;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --border: rgba(255, 255, 255, 0.1);
    --glass-bg: rgba(30, 41, 59, 0.7);
    --glass-border: rgba(255, 255, 255, 0.05);
}
"""

if '[data-theme="dark"]' not in css:
    css = css.replace('}\n\n* {', '}\n' + dark_theme_tokens + '\n* {')

# Fix hardcoded colors
css = css.replace('color: #1a202c;', 'color: var(--text-main);')
css = css.replace('background: #ffffff;', 'background: var(--secondary-bg);')
css = css.replace('background: #eae5de;', 'background: var(--border);')
css = css.replace('background: rgba(252, 251, 250, 0.85);', 'background: rgba(var(--primary-bg-rgb, 15, 23, 42), 0.85); backdrop-filter: blur(10px);') # Reverting to transparent fallback
# Actually, the modal-overlay can just use a strong background
css = css.replace('background: rgba(var(--primary-bg-rgb, 15, 23, 42), 0.85); backdrop-filter: blur(10px);', 'background: var(--primary-bg); opacity: 0.95;') 
css = re.sub(r'background: rgba\(252, 251, 250, 0\.85\);', 'background: var(--primary-bg);\n    opacity: 0.95; /* Fake opacity for modal */', css)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

# 3. Update JS: Add logic for the toggle button
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

theme_logic = """
    // Main Theme Toggle
    const mainThemeToggle = document.getElementById('mainThemeToggle');
    if (mainThemeToggle) {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        }
        
        mainThemeToggle.addEventListener('click', () => {
            if (document.body.getAttribute('data-theme') === 'dark') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }
"""

if 'mainThemeToggle' not in js:
    # insert before initApp ends
    closing_brace_index = js.rfind('}\n\nif (document.readyState === \'loading\')')
    if closing_brace_index != -1:
        js = js[:closing_brace_index] + theme_logic + js[closing_brace_index:]
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js)

print("Added dark mode support across all files.")
