import sys
import re

css_path = '/Users/ormaman/New_Manitou/style.css'
html_path = '/Users/ormaman/New_Manitou/index.html'

# 1. Fix CSS for Dark Mode overrides and Floating Buttons
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Add proper Dark Mode overrides for the elements that were hardcoded for Light Mode
dark_mode_fixes = """
/* Dark Mode Fixes */
[data-theme="dark"] .book-cover { background: var(--secondary-bg); }
[data-theme="dark"] .cover-design-1 { background: linear-gradient(135deg, #155e75 0%, #083344 100%); }
[data-theme="dark"] .cover-design-2 { background: linear-gradient(135deg, #451a03 0%, #291002 100%); }
[data-theme="dark"] .cover-design-3 { background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); }
[data-theme="dark"] .hero-title { color: var(--text-main); }
[data-theme="dark"] .modal-cover { background: #0f172a; }
[data-theme="dark"] .book-title-overlay h3 { color: #f8fafc; }
[data-theme="dark"] .book-card::before { background: linear-gradient(to bottom, transparent 60%, rgba(15, 23, 42, 0.9) 100%); }
"""

if '/* Dark Mode Fixes */' not in css:
    css += '\n' + dark_mode_fixes

# Fix FAB buttons to be on the left, pill-shaped, with text
fab_css_replacement = """
.floating-actions {
    position: fixed;
    bottom: 30px;
    left: 30px; /* Left side to avoid RTL scrollbar overlap */
    display: flex;
    flex-direction: column;
    gap: 15px;
    z-index: 90;
}

.fab-btn {
    height: 55px;
    padding: 0 20px;
    border-radius: 30px;
    background: var(--accent);
    color: var(--primary-bg);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 1rem;
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
}
"""

css = re.sub(r'\.floating-actions \{.*?.fab-btn:hover \{', fab_css_replacement + '\n.fab-btn:hover {', css, flags=re.DOTALL)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update HTML to add text to the FAB buttons
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

new_fabs = """
    <!-- Floating Actions -->
    <div class="floating-actions">
        <button class="fab-btn" id="fabThemeToggle" title="מצב לילה / יום">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <span id="themeBtnText">מצב לילה</span>
        </button>
        <a href="#" class="fab-btn" id="fabHome" title="חזור לראש העמוד">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>ראשי (Home)</span>
        </a>
    </div>
"""

html = re.sub(r'<!-- Floating Actions -->.*?</div>', new_fabs.strip(), html, flags=re.DOTALL)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

# 3. Update JS to toggle the text of the theme button
js_path = '/Users/ormaman/New_Manitou/script.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

js_replacement = """
    // FAB Theme Toggle
    const fabThemeToggle = document.getElementById('fabThemeToggle');
    const themeBtnText = document.getElementById('themeBtnText');
    
    function updateThemeBtnText() {
        if(themeBtnText) {
            themeBtnText.textContent = document.body.getAttribute('data-theme') === 'dark' ? 'מצב יום' : 'מצב לילה';
        }
    }
    
    if (fabThemeToggle) {
        fabThemeToggle.addEventListener('click', () => {
            if (document.body.getAttribute('data-theme') === 'dark') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            updateThemeBtnText();
        });
        updateThemeBtnText(); // Init
    }
"""

js = re.sub(r'// FAB Theme Toggle.*?}\n', js_replacement, js, flags=re.DOTALL)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)

print("Fixed Dark Mode overrides and made floating buttons bigger with text on the left side.")
