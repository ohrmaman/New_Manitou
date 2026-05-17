import sys

file_path = '/Users/ormaman/New_Manitou/script.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Modify openReader signature and behavior
content = content.replace('async function openReader(book) {', 'async function openReader(book, targetChapterId = null) {')

# Find the part where it loads chapter[0] and replace it to use targetChapterId
target_load_logic = """            if (chapters && chapters.length > 0) {
                renderChaptersList(chapters);
                loadChapter(chapters[0]);
            } else {"""

replacement_load_logic = """            if (chapters && chapters.length > 0) {
                renderChaptersList(chapters);
                let targetChap = chapters[0];
                if (targetChapterId) {
                    const found = chapters.find(c => c.id === targetChapterId);
                    if (found) targetChap = found;
                }
                // also highlight it in sidebar
                document.querySelectorAll('.chapters-list li').forEach(el => {
                    el.classList.remove('active');
                    if(el.textContent === targetChap.title) el.classList.add('active');
                });
                loadChapter(targetChap);
            } else {"""

content = content.replace(target_load_logic, replacement_load_logic)

# 2. Add Deep Search UI elements and logic at the end (before the initApp closing brace)
search_logic = """
    // --- Deep Search Logic ---
    const openDeepSearchBtn = document.getElementById('openDeepSearchBtn');
    const deepSearchModal = document.getElementById('deepSearchModal');
    const closeDeepSearch = document.getElementById('closeDeepSearch');
    const executeDeepSearch = document.getElementById('executeDeepSearch');
    const deepSearchInput = document.getElementById('deepSearchInput');
    const deepSearchResults = document.getElementById('deepSearchResults');

    if(openDeepSearchBtn) {
        openDeepSearchBtn.addEventListener('click', () => {
            deepSearchModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            setTimeout(() => deepSearchInput.focus(), 100);
        });
    }

    if(closeDeepSearch) {
        closeDeepSearch.addEventListener('click', () => {
            deepSearchModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    if (deepSearchInput) {
        deepSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeDeepSearch.click();
        });
    }

    if(executeDeepSearch) {
        executeDeepSearch.addEventListener('click', async () => {
            const query = deepSearchInput.value.trim().toLowerCase();
            if (!query) return;
            
            deepSearchResults.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>סורק את כל הספרים במאגר...</p></div>';
            
            let allResults = [];
            
            // Iterate all books to fetch their data
            for (const b of books) {
                try {
                    const res = await fetch(`data/book_${b.id}.json`);
                    if (res.ok) {
                        const chapters = await res.json();
                        chapters.forEach(chap => {
                            if (!chap.text) return;
                            
                            // Strip HTML tags for clean searching
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = chap.text;
                            const plainText = tempDiv.textContent || tempDiv.innerText || "";
                            
                            const lowerText = plainText.toLowerCase();
                            let index = lowerText.indexOf(query);
                            
                            // Find all occurrences in this chapter
                            let occurrences = 0;
                            while (index !== -1 && occurrences < 3) { // limit to 3 snippets per chapter
                                const start = Math.max(0, index - 60);
                                const end = Math.min(plainText.length, index + query.length + 60);
                                
                                let snippet = plainText.substring(start, end);
                                if (start > 0) snippet = '...' + snippet;
                                if (end < plainText.length) snippet = snippet + '...';
                                
                                // Highlight the query using Regex for case-insensitive exact replacement
                                const regex = new RegExp(`(${query})`, 'gi');
                                snippet = snippet.replace(regex, '<mark style="background: var(--accent); color: var(--primary-bg); padding: 0 4px; border-radius: 3px;">$1</mark>');
                                
                                allResults.push({
                                    book: b,
                                    chapter: chap,
                                    snippet: snippet
                                });
                                
                                index = lowerText.indexOf(query, index + query.length);
                                occurrences++;
                            }
                        });
                    }
                } catch (e) {
                    // Skip if not downloaded yet
                }
            }
            
            // Render results
            if (allResults.length === 0) {
                deepSearchResults.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); margin-top: 3rem;">
                        <h3>לא נמצאו תוצאות עבור "${query}"</h3>
                        <p>נסה לחפש מילה אחרת, או ודא שהספרים הרלוונטיים כבר נסרקו למערכת.</p>
                    </div>
                `;
                return;
            }
            
            let html = `<h3 style="margin-bottom: 1.5rem; color: var(--text-main);">נמצאו ${allResults.length} תוצאות:</h3><div style="display: flex; flex-direction: column; gap: 1rem;">`;
            
            allResults.forEach((res, i) => {
                html += `
                    <div class="search-result-card" data-index="${i}" style="background: var(--primary-bg); border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                        <div style="font-size: 0.85rem; color: var(--accent); margin-bottom: 0.5rem; font-weight: bold;">
                            ${res.book.title} > ${res.chapter.title}
                        </div>
                        <p style="color: var(--text-main); font-size: 1.05rem; line-height: 1.6;">
                            ${res.snippet}
                        </p>
                    </div>
                `;
            });
            html += '</div>';
            
            deepSearchResults.innerHTML = html;
            
            // Add click listeners to cards
            document.querySelectorAll('.search-result-card').forEach(card => {
                card.addEventListener('mouseenter', () => card.style.borderColor = 'var(--accent)');
                card.addEventListener('mouseleave', () => card.style.borderColor = 'var(--border)');
                card.addEventListener('click', () => {
                    const res = allResults[card.dataset.index];
                    deepSearchModal.classList.remove('active');
                    openReader(res.book, res.chapter.id);
                    
                    // After a short delay, highlight the word in the reader!
                    setTimeout(() => {
                        const contentArea = document.getElementById('textContent');
                        if (contentArea) {
                            // Simple highlighting in the actual HTML content
                            // This is complex due to HTML tags, but a basic replace works for demonstration
                            // Since we have HTML, we must be careful not to break tags.
                            // We can use a TreeWalker or just basic innerHTML replacement with caution.
                            const regex = new RegExp(`(?![^<]+>)(${query})`, 'gi');
                            contentArea.innerHTML = contentArea.innerHTML.replace(regex, '<mark style="background: var(--accent); color: var(--primary-bg);">$1</mark>');
                            
                            // Scroll to first mark
                            const firstMark = contentArea.querySelector('mark');
                            if (firstMark) {
                                firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }, 500);
                });
            });
        });
    }
"""

# Insert before the last closing brace of initApp
closing_brace_index = content.rfind('}\n\nif (document.readyState === \'loading\')')
if closing_brace_index != -1:
    new_content = content[:closing_brace_index] + search_logic + content[closing_brace_index:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Injected deep search logic.")
else:
    print("Could not find insertion point.")
