import sys
import re

html_path = '/Users/ormaman/New_Manitou/index.html'
css_path = '/Users/ormaman/New_Manitou/style.css'
js_path = '/Users/ormaman/New_Manitou/script.js'

# 1. Update HTML: Replace user-actions with new buttons, and remove floating-actions
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

new_user_actions = """
            <div class="user-actions" style="display: flex; gap: 10px; align-items: center;">
                <div class="user-greeting" style="margin-left: 10px;">שלום אור ממן</div>
                <button id="navThemeToggle" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 8px; border-radius: 20px; padding: 0.5rem 1rem; cursor: pointer; border: 1px solid var(--border); background: var(--secondary-bg); color: var(--text-main);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    <span id="navThemeText">מצב לילה</span>
                </button>
                <button id="navHomeBtn" class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 8px; border-radius: 20px; padding: 0.5rem 1rem; cursor: pointer; border: none; background: var(--accent); color: var(--primary-bg);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    <span>ראשי</span>
                </button>
            </div>
"""

# Replace old user actions
html = re.sub(r'<div class="user-actions">.*?</div>\n        </nav>', new_user_actions.strip() + '\n        </nav>', html, flags=re.DOTALL)

# Remove floating actions
html = re.sub(r'<!-- Floating Actions -->.*?</div>', '', html, flags=re.DOTALL)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

# 2. Update CSS: Make navbar sticky and remove FABs
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

# Make navbar sticky
css = css.replace('position: relative;\n    z-index: 10;', 'position: sticky;\n    top: 0;\n    z-index: 100;\n    background: var(--primary-bg);\n    padding: 1.5rem 2rem;\n    margin: 0 -2rem 4rem -2rem; /* counteract app-container padding for full sticky */')

# Remove floating-actions css
css = re.sub(r'\.floating-actions \{.*?.fab-btn:hover \{.*?\}', '', css, flags=re.DOTALL)

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css)

# 3. Update JS: Hook up the new nav buttons
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

js_replacement = """
    // Nav Theme Toggle
    const navThemeToggle = document.getElementById('navThemeToggle');
    const navThemeText = document.getElementById('navThemeText');
    
    function updateThemeBtnText() {
        if(navThemeText) {
            navThemeText.textContent = document.body.getAttribute('data-theme') === 'dark' ? 'מצב יום' : 'מצב לילה';
        }
    }
    
    if (navThemeToggle) {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        }
        
        navThemeToggle.addEventListener('click', () => {
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

    // Nav Home (Scroll to top)
    const navHomeBtn = document.getElementById('navHomeBtn');
    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
"""

# Replace all old theme toggle code with the new nav button logic
js = re.sub(r'// Main Theme Toggle.*?// FAB Home \(Scroll to top\).*?\}\n', js_replacement, js, flags=re.DOTALL)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)

print("Moved buttons to sticky navbar.")
