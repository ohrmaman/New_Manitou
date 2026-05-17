import sys

html_path = '/Users/ormaman/New_Manitou/index.html'
css_path = '/Users/ormaman/New_Manitou/style.css'
js_path = '/Users/ormaman/New_Manitou/script.js'

# 1. Update HTML: Add floating buttons at the bottom corner
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

floating_buttons = """
    <!-- Floating Actions -->
    <div class="floating-actions">
        <a href="#" class="fab-btn" id="fabHome" title="חזור לראש העמוד">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </a>
        <button class="fab-btn" id="fabThemeToggle" title="מצב לילה / יום">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>
    </div>
"""

if 'class="floating-actions"' not in html:
    html = html.replace('</body>', floating_buttons + '\n</body>')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)

# 2. Update CSS for Floating Actions
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

fab_css = """
/* Floating Action Buttons */
.floating-actions {
    position: fixed;
    bottom: 30px;
    right: 30px; /* RTL layout */
    display: flex;
    flex-direction: column;
    gap: 15px;
    z-index: 90;
}

.fab-btn {
    width: 55px;
    height: 55px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--primary-bg);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    transition: var(--transition);
}

.fab-btn:hover {
    transform: scale(1.1) translateY(-5px);
    background: var(--accent-hover);
    box-shadow: 0 15px 30px rgba(184, 134, 69, 0.4);
}
"""

if '.floating-actions {' not in css:
    css = css + '\n' + fab_css
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)

# 3. Update JS for the new FAB buttons
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

fab_js = """
    // FAB Theme Toggle
    const fabThemeToggle = document.getElementById('fabThemeToggle');
    if (fabThemeToggle) {
        fabThemeToggle.addEventListener('click', () => {
            if (document.body.getAttribute('data-theme') === 'dark') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // FAB Home (Scroll to top)
    const fabHome = document.getElementById('fabHome');
    if (fabHome) {
        fabHome.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
"""

if 'fabThemeToggle' not in js:
    closing_brace_index = js.rfind('}\n\nif (document.readyState === \'loading\')')
    if closing_brace_index != -1:
        js = js[:closing_brace_index] + fab_js + js[closing_brace_index:]
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(js)

print("Added floating home and theme buttons.")
