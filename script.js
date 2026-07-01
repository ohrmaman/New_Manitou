let books = [];

function initApp() {
    const booksGrid = document.getElementById('booksGrid');
    const searchInput = document.getElementById('searchInput');
    const tabs = document.querySelectorAll('.tab');
    const modal = document.getElementById('bookModal');
    const closeModal = document.getElementById('closeModal');
    const modalBody = document.getElementById('modalBody');
    const continueReadingBtn = document.getElementById('continueReadingBtn');

    // Mobile Drawer elements
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const drawerProfileBtn = document.getElementById('drawerProfileBtn');
    const drawerThemeToggle = document.getElementById('drawerThemeToggle');

    // Chapter cache
    const chapterCache = {};

    // Check for last read book
    const lastReadBookId = localStorage.getItem('lastReadBookId');
    const lastReadChapterId = localStorage.getItem('lastReadChapterId');
    
    // Profile Data
    let favoriteBooks = JSON.parse(localStorage.getItem('favoriteBooks')) || [];
    let savedHighlights = JSON.parse(localStorage.getItem('savedHighlights')) || [];
    
    if (lastReadBookId && continueReadingBtn) {
        continueReadingBtn.style.display = 'inline-flex';
        continueReadingBtn.addEventListener('click', () => {
            const book = books.find(b => b.id == lastReadBookId);
            if (book) {
                openReader(book, lastReadChapterId);
            }
        });
    }

    // Render Books
    function renderBooks(booksToRender) {
        booksGrid.innerHTML = '';
        
        if (booksToRender.length === 0) {
            booksGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h3>לא נמצאו ספרים תואמים לחיפוש</h3>
                </div>
            `;
            return;
        }

        booksToRender.forEach((book, index) => {
            const delay = index * 0.05;
            const bookEl = document.createElement('div');
            bookEl.className = 'book-card';
            bookEl.style.animation = `fadeInUp 0.6s ease ${delay}s backwards`;
            
            // Generate inline style for book cover if imgUrl exists
            const bgStyle = book.imgUrl ? `style="background-image: url('${book.imgUrl}'); background-size: cover; background-position: center;"` : "";
            
            // Only show title overlay if there is no image
            const overlayContent = book.imgUrl ? '' : `
                <div class="book-title-overlay">
                    <h3>${book.title}</h3>
                    <div class="gold-line"></div>
                    <p>מכון מניטו</p>
                </div>
            `;
            
            const isFav = favoriteBooks.includes(book.id);
            const favIconClass = isFav ? 'fav-active' : '';
            const heartSvg = isFav ? 
                `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>` : 
                `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

            bookEl.innerHTML = `
                <button class="fav-btn ${favIconClass}" data-id="${book.id}">
                    ${heartSvg}
                </button>
                <div class="book-cover ${book.design}" ${bgStyle}>
                    <div class="book-spine-effect"></div>
                    ${overlayContent}
                    <button class="read-btn">פתח ארכיון</button>
                </div>
                <div class="book-info">
                    <span class="book-category">${book.categoryLabel}</span>
                    <h4 class="book-name">${book.title}</h4>
                    <p class="book-desc">${book.description}</p>
                </div>
            `;

            bookEl.addEventListener('click', (e) => {
                const favBtn = e.target.closest('.fav-btn');
                if (favBtn) {
                    if (typeof toggleFavorite === 'function') {
                        toggleFavorite(book.id, favBtn);
                    }
                    return;
                }
                openModal(book);
            });
            booksGrid.appendChild(bookEl);
        });
    }

    // Open Modal
    function openModal(book) {
        const bgStyle = book.imgUrl ? `style="background-image: url('${book.imgUrl}'); background-size: cover; background-position: center;"` : "";
        const overlayContent = book.imgUrl ? '' : `
            <div class="book-title-overlay" style="top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%;">
                <h3 style="font-size: 2.5rem;">${book.title}</h3>
                <div class="gold-line"></div>
            </div>
        `;

        modalBody.innerHTML = `
            <div class="modal-cover ${book.design}" ${bgStyle}>
                <div class="book-spine-effect"></div>
                ${overlayContent}
            </div>
            <div class="modal-info">
                <div class="modal-category">${book.categoryLabel}</div>
                <h2 class="modal-title">${book.title}</h2>
                <p class="modal-desc">${book.description}</p>
                
                <div style="margin-bottom: 2rem;">
                    <h4 style="color: var(--text-main); margin-bottom: 0.5rem; font-family: var(--font-sans);">פרטים נוספים</h4>
                    <ul style="color: var(--text-muted); list-style-position: inside; font-size: 0.95rem;">
                        <li>מקור: ארכיון מכון מניטו</li>
                        <li>גישה: מקוונת למורשים</li>
                    </ul>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary" id="openReaderBtn">קרא באתר המקומי (מצב קריאה)</button>
                    <a href="${book.link}" target="_blank" class="btn btn-secondary" style="text-decoration: none; display: inline-block;">המשך לספר באתר המקורי</a>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        // Add event listener for the new Read Locally button
        setTimeout(() => {
            const openReaderBtn = document.getElementById('openReaderBtn');
            if (openReaderBtn) {
                openReaderBtn.addEventListener('click', () => {
                    window.location.hash = `#/reader/${book.id}`;
                });
            }
        }, 100);
    }

    // Close Modal
    closeModal.addEventListener('click', () => {
        window.location.hash = '#/';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            window.location.hash = '#/';
        }
    });

    // Reader Mode Logic
    const readerMode = document.getElementById('readerMode');
    const backToLibrary = document.getElementById('backToLibrary');
    const readerBookTitle = document.getElementById('readerBookTitle');
    const readerChapterTitle = document.getElementById('readerChapterTitle');
    const chaptersList = document.getElementById('chaptersList');
    const textContent = document.getElementById('textContent');
    const toggleThemeBtn = document.getElementById('toggleTheme');
    const librarySection = document.getElementById('librarySection');

    async function openReader(book, targetChapterId = null) {
        // Show Reader
        readerMode.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        readerBookTitle.textContent = book.title;
        chaptersList.innerHTML = '<li style="text-align:center; padding: 1rem;"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div></li>';
        textContent.innerHTML = `
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
            <br>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
        `;
        
        // Setup Progress Bar Scroll Listener
        const readerContentArea = document.querySelector('.reader-content-area');
        const progressBar = document.getElementById('readerProgressBar');
        readerContentArea.addEventListener('scroll', () => {
            const scrollTop = readerContentArea.scrollTop;
            const scrollHeight = readerContentArea.scrollHeight - readerContentArea.clientHeight;
            const scrollPercentage = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            progressBar.style.width = scrollPercentage + '%';
        });
        
        try {
            let chapters;
            if (chapterCache[book.id]) {
                chapters = chapterCache[book.id];
            } else {
                const response = await fetch(`data/book_${book.id}.json`);
                if (!response.ok) {
                    throw new Error("File not found");
                }
                chapters = await response.json();
                chapterCache[book.id] = chapters;
            }
            
            if (chapters && chapters.length > 0) {
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
                loadChapter(targetChap, book);
            } else {
                chaptersList.innerHTML = '';
                textContent.innerHTML = '<p style="text-align:center;">לא נמצאו פרקים לספר זה.</p>';
            }
        } catch (e) {
            chaptersList.innerHTML = '';
            textContent.innerHTML = `
                <div style="text-align:center; margin-top:2rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5; color: var(--accent);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <h3>הספר עדיין לא נסרק למערכת</h3>
                    <p style="color: var(--text-muted); margin-top: 1rem;">תהליך השאיבה משרתי מניטו פועל עכשיו ברקע כדי להביא את כל מאות הפרקים. זה יכול לקחת מספר דקות.</p>
                    <p style="color: var(--text-muted);">נסה שוב מאוחר יותר.</p>
                </div>
            `;
            const downloadBtn = document.getElementById('downloadPdfBtn');
            if(downloadBtn) downloadBtn.style.display = 'none';
        }
    }

    function renderChaptersList(chapters) {
        chaptersList.innerHTML = '';
        chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.textContent = chapter.title;
            if (index === 0) li.classList.add('active');
            
            li.addEventListener('click', () => {
                const currentBookTitle = document.getElementById('readerBookTitle').textContent;
                const currentBook = books.find(b => b.title === currentBookTitle);
                if (currentBook) {
                    window.location.hash = `#/reader/${currentBook.id}/chapter/${chapter.id}`;
                }
            });
            
            chaptersList.appendChild(li);
        });
    }

    function loadChapter(chapter, book) {
        readerChapterTitle.textContent = chapter.title;
        
        // Save to local storage for "Continue Reading"
        if (book) {
            localStorage.setItem('lastReadBookId', book.id);
            localStorage.setItem('lastReadChapterId', chapter.id);
            if(continueReadingBtn) {
                continueReadingBtn.style.display = 'inline-flex';
                // Remove old event listeners if any, by cloning the button (simple way)
                const newBtn = continueReadingBtn.cloneNode(true);
                continueReadingBtn.parentNode.replaceChild(newBtn, continueReadingBtn);
                newBtn.addEventListener('click', () => {
                    openReader(book, chapter.id);
                });
            }
        }
        
        // Clean up the text content (remove Joomla Komento comments, broken logos, etc.)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = chapter.text;
        
        // Remove known comment elements and broken plugins
        const junkSelectors = [
            '[id^="komento"]',
            '[class*="komento"]',
            '.buttonheading', // Joomla print/email buttons
            '.item-page-nav', // Next/prev links
            '.icons',
            'script',
            'style',
            '#comments',
            '.comments-area',
            '#kmt-form',
            '.kmt-wrap'
        ];
        
        junkSelectors.forEach(sel => {
            const els = tempDiv.querySelectorAll(sel);
            els.forEach(el => el.remove());
        });
        
        // Add extra safe selectors for Joomla comments and components
        const extraJunkSelectors = [
            '#section-kmt', 
            '.kmt-list',
            '.kmt-control-user',
            '.kmt-form-content',
            '.kmt-wrap',
            '.komento'
        ];
        extraJunkSelectors.forEach(sel => {
            const els = tempDiv.querySelectorAll(sel);
            els.forEach(el => el.remove());
        });
        
        // Remove empty images or broken logos
        const allImages = tempDiv.querySelectorAll('img');
        allImages.forEach(img => {
            const src = img.getAttribute('src');
            if (!src || src.includes('blank') || src.includes('komento') || src.trim() === '') {
                img.remove();
            }
        });

        // --- Glossary Tooltips ---
        const glossary = {
            "תולדות": "מושג מרכזי המבטא את ההיסטוריה כתהליך התפתחותי של האנושות ושל עם ישראל אל עבר ייעודו.",
            "עברי": "מי שנמצא בעבר האחר, נושא המוסר המוחלט, המגשר בין הקודש לחול ובין העמים.",
            "זהות": "מי שאני באמת, ולא רק איך שהסביבה מגדירה אותי. אצל מניטו הזהות היהודית איננה רק דת אלא מהות לאומית-אוניברסלית."
        };
        
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent;
                let replaced = false;
                for (const [term, definition] of Object.entries(glossary)) {
                    // Match whole word with basic Hebrew punctuation handling
                    const regex = new RegExp(`(^|\\s|[.,;!?])(${term})(?=\\s|[.,;!?]|$)`, 'g');
                    if (regex.test(text)) {
                        text = text.replace(regex, `$1<span class="glossary-term">$2<span class="glossary-tooltip">${definition}</span></span>`);
                        replaced = true;
                    }
                }
                if (replaced) {
                    const span = document.createElement('span');
                    span.innerHTML = text;
                    node.replaceWith(...span.childNodes);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE'].includes(node.tagName)) {
                // Must clone array because we are modifying childNodes during iteration
                Array.from(node.childNodes).forEach(processNode);
            }
        }
        Array.from(tempDiv.childNodes).forEach(processNode);

        textContent.innerHTML = tempDiv.innerHTML;
        textContent.parentElement.scrollTop = 0;
        
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            if (chapter.local_pdf) {
                downloadBtn.style.display = 'inline-flex';
                downloadBtn.onclick = () => window.open(chapter.local_pdf, '_blank');
            } else if (chapter.pdf_url) {
                downloadBtn.style.display = 'inline-flex';
                downloadBtn.onclick = () => window.open(chapter.pdf_url, '_blank');
            } else {
                downloadBtn.style.display = 'none';
            }
        }
    }

    // Close Reader Mode
    backToLibrary.addEventListener('click', () => {
        window.location.hash = '#/';
    });

    // Sidebar toggle for mobile
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const chaptersSidebar = document.querySelector('.chapters-sidebar');
    if (toggleSidebarBtn && chaptersSidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            chaptersSidebar.classList.toggle('active');
        });
    }

    // Toggle Light/Dark Theme in Reader
    toggleThemeBtn.addEventListener('click', () => {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
        updateThemeBtnText();
    });

    // --- Text Settings Logic ---
    const toggleTextSettingsBtn = document.getElementById('toggleTextSettingsBtn');
    const textSettingsDropdown = document.getElementById('textSettingsDropdown');
    const decreaseFontBtn = document.getElementById('decreaseFontBtn');
    const increaseFontBtn = document.getElementById('increaseFontBtn');
    const fontSizeDisplay = document.getElementById('fontSizeDisplay');
    const fontBtns = document.querySelectorAll('.font-btn');

    let currentFontSize = parseFloat(localStorage.getItem('readerFontSize')) || 1.15;
    let currentFontFamily = localStorage.getItem('readerFontFamily') || 'serif';
    
    function applyTextSettings() {
        if(textContent) {
            textContent.style.fontSize = currentFontSize + 'rem';
            textContent.style.fontFamily = currentFontFamily === 'sans' ? 'var(--font-sans)' : 'var(--font-serif)';
            
            // Update display
            const percent = Math.round((currentFontSize / 1.15) * 100);
            if(fontSizeDisplay) fontSizeDisplay.textContent = percent + '%';
            
            // Update font buttons
            fontBtns.forEach(btn => {
                if (btn.dataset.font === currentFontFamily) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            localStorage.setItem('readerFontSize', currentFontSize);
            localStorage.setItem('readerFontFamily', currentFontFamily);
        }
    }
    
    if (toggleTextSettingsBtn && textSettingsDropdown) {
        toggleTextSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = textSettingsDropdown.style.display === 'block';
            textSettingsDropdown.style.display = isVisible ? 'none' : 'block';
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!toggleTextSettingsBtn.contains(e.target) && !textSettingsDropdown.contains(e.target)) {
                textSettingsDropdown.style.display = 'none';
            }
        });
        
        decreaseFontBtn.addEventListener('click', () => {
            if (currentFontSize > 0.8) {
                currentFontSize -= 0.1;
                applyTextSettings();
            }
        });
        
        increaseFontBtn.addEventListener('click', () => {
            if (currentFontSize < 2.5) {
                currentFontSize += 0.1;
                applyTextSettings();
            }
        });
        
        fontBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentFontFamily = btn.dataset.font;
                applyTextSettings();
            });
        });
        
        // Initial application
        applyTextSettings();
    }

    // Filtering
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.dataset.filter;
            const searchTerm = searchInput.value.toLowerCase();
            filterBooks(filter, searchTerm);
        });
    });

    // Searching
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeTabEl = document.querySelector('.tabs-container .tab.active');
        const activeTab = activeTabEl ? activeTabEl.dataset.filter : 'all';
        filterBooks(activeTab, searchTerm);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchInput.blur();
            const searchTerm = searchInput.value.toLowerCase();
            const activeTabEl = document.querySelector('.tabs-container .tab.active');
            const activeTab = activeTabEl ? activeTabEl.dataset.filter : 'all';
            filterBooks(activeTab, searchTerm);
        }
    });

    // --- Advanced Search Section Logic ---
    const scrollToAdvSearchBtn = document.getElementById('scrollToAdvSearch');
    const advSearchSection = document.getElementById('advancedSearchSection');
    const advSearchInput = document.getElementById('advSearchInput');
    const advSearchBtn = document.getElementById('advSearchBtn');
    const advSearchResults = document.getElementById('advSearchResults');
    const advSearchCategory = document.getElementById('advSearchCategory');
    const advSearchToolbarButtons = document.querySelectorAll('#advSearchToolbar .toolbar-btn');
    
    let currentSearchMode = 'and'; // 'and', 'or', 'exact'

    if (scrollToAdvSearchBtn && advSearchSection) {
        scrollToAdvSearchBtn.addEventListener('click', () => {
            advSearchSection.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => advSearchInput.focus(), 500);
        });
    }

    // Handle Toolbar Mode Selection
    if (advSearchToolbarButtons) {
        advSearchToolbarButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                advSearchToolbarButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'var(--secondary-bg)';
                    b.style.color = 'var(--text-muted)';
                    b.style.border = '2px solid var(--border)';
                });
                btn.classList.add('active');
                btn.style.background = 'var(--accent)';
                btn.style.color = 'var(--primary-bg)';
                btn.style.border = '2px solid var(--accent)';
                currentSearchMode = btn.dataset.mode;
            });
        });
    }

    if (advSearchInput) {
        advSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') advSearchBtn.click();
        });
    }

    if(advSearchBtn) {
        advSearchBtn.addEventListener('click', async () => {
            let rawQuery = advSearchInput.value.trim().toLowerCase();
            if (!rawQuery) return;
            
            const categoryFilter = advSearchCategory ? advSearchCategory.value : 'all';
            
            advSearchResults.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>סורק את הספרים במאגר...</p></div>';
            
            let allResults = [];
            
            // If user typed quotes manually, force exact mode, otherwise use toolbar mode
            const isManualExact = rawQuery.startsWith('"') && rawQuery.endsWith('"');
            const searchMode = isManualExact ? 'exact' : currentSearchMode;
            
            let searchWords = [];
            if (searchMode === 'exact' || searchMode === 'exact_word') {
                searchWords = isManualExact ? [rawQuery.slice(1, -1).trim()] : [rawQuery];
            } else {
                searchWords = rawQuery.split(/\s+/).filter(w => w.length > 0);
            }
            
            if (searchWords.length === 0) {
                advSearchResults.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>נא להזין מילת חיפוש חוקית.</p></div>';
                return;
            }
            
            // Iterate all books to fetch their data
            for (const b of books) {
                if (categoryFilter !== 'all' && b.category !== categoryFilter) continue;
                
                try {
                    const res = await fetch(`data/book_${b.id}.json`);
                    if (res.ok) {
                        const chapters = await res.json();
                        chapters.forEach(chap => {
                            if (!chap.text) return;
                            
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = chap.text;
                            const plainText = tempDiv.textContent || tempDiv.innerText || "";
                            const lowerText = plainText.toLowerCase();
                            
                            // Check match based on mode
                            let isMatch = false;
                            if (searchMode === 'exact') {
                                isMatch = lowerText.includes(searchWords[0]);
                            } else if (searchMode === 'exact_word') {
                                const escapedWord = searchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'i');
                                isMatch = regex.test(lowerText);
                            } else if (searchMode === 'and') {
                                isMatch = searchWords.every(word => lowerText.includes(word));
                            } else if (searchMode === 'or') {
                                isMatch = searchWords.some(word => lowerText.includes(word));
                            }
                            
                            if (!isMatch) return;
                            
                            // Calculate score for sorting (optional feature, we'll just count total occurrences)
                            let matchScore = 0;
                            searchWords.forEach(word => {
                                const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regexPattern = searchMode === 'exact_word' 
                                    ? `(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])` 
                                    : escapedWord;
                                const occurrences = (lowerText.match(new RegExp(regexPattern, 'gi')) || []).length;
                                matchScore += occurrences;
                            });
                            
                            // Find first occurrence to center snippet
                            let index = -1;
                            let firstFoundWord = '';
                            if (searchMode === 'exact_word') {
                                const escapedWord = searchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'i');
                                const match = regex.exec(lowerText);
                                if (match) {
                                    index = match.index;
                                }
                            } else {
                                firstFoundWord = searchWords.find(word => lowerText.includes(word));
                                if (firstFoundWord) {
                                    index = lowerText.indexOf(firstFoundWord);
                                }
                            }
                            
                            // In Exact mode we can return up to 3 snippets. In AND/OR we return 1 long snippet.
                            let occurrences = 0;
                            while (index !== -1 && occurrences < (searchMode === 'exact' || searchMode === 'exact_word' ? 3 : 1)) {
                                const start = Math.max(0, index - 80);
                                const end = Math.min(plainText.length, index + 200); 
                                
                                let snippet = plainText.substring(start, end);
                                if (start > 0) snippet = '...' + snippet;
                                if (end < plainText.length) snippet = snippet + '...';
                                
                                searchWords.forEach(word => {
                                    try {
                                        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                        const regex = searchMode === 'exact_word'
                                            ? new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])(${escapedWord})(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'gi')
                                            : new RegExp(`(${escapedWord})`, 'gi');
                                        snippet = snippet.replace(regex, '%%MARK%%$1%%ENDMARK%%');
                                    } catch(e) {}
                                });
                                
                                snippet = snippet.replace(/%%MARK%%/g, '<mark style="background: var(--accent); color: var(--primary-bg); padding: 0 4px; border-radius: 3px;">');
                                snippet = snippet.replace(/%%ENDMARK%%/g, '</mark>');
                                
                                allResults.push({
                                    book: b,
                                    chapter: chap,
                                    snippet: snippet,
                                    score: matchScore
                                });
                                
                                if (searchMode === 'exact_word') {
                                    const escapedWord = searchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'gi');
                                    regex.lastIndex = index + searchWords[0].length;
                                    const nextMatch = regex.exec(lowerText);
                                    index = nextMatch ? nextMatch.index : -1;
                                } else {
                                    index = lowerText.indexOf(firstFoundWord, index + firstFoundWord.length);
                                }
                                occurrences++;
                            }
                        });
                    }
                } catch (e) {
                    // Skip if not downloaded
                }
            }
            
            // Sort OR results by score
            if (searchMode === 'or') {
                allResults.sort((a, b) => b.score - a.score);
            }
            
            // Render results
            if (allResults.length === 0) {
                advSearchResults.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); margin-top: 3rem;">
                        <h3>לא נמצאו תוצאות עבור החיפוש</h3>
                        <p>נסה לשנות את סוג החיפוש (למשל מ-AND ל-OR) או לחפש מילים אחרות.</p>
                    </div>
                `;
                return;
            }
            
            advSearchResults.innerHTML = `
                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--text-main); font-family: var(--font-serif);">נמצאו ${allResults.length} תוצאות</h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    ${allResults.map(res => `
                        <div class="search-result-item" style="padding: 1.5rem; background: var(--primary-bg); border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="font-weight: bold; color: var(--accent); font-family: var(--font-serif); font-size: 1.2rem;">${res.book.title}</span>
                                <span style="color: var(--text-muted); font-size: 0.9rem;">${res.chapter.title} ${res.score ? `(ציון התאמה: ${res.score})` : ''}</span>
                            </div>
                            <p style="color: var(--text-main); line-height: 1.6; font-size: 1rem;">${res.snippet}</p>
                            <button class="btn btn-sm" onclick="openBookToChapter(${res.book.id}, ${res.chapter.id}, '${rawQuery.replace(/'/g, "\\'")}')" style="margin-top: 1rem; border: 1px solid var(--accent); color: var(--accent); background: transparent; padding: 0.3rem 1rem; border-radius: 20px; cursor: pointer;">פתח ספר זה</button>
                        </div>
                    `).join('')}
                </div>
            `;
        });
    }

    const searchBtn = searchInput.nextElementSibling;
    if (searchBtn && searchBtn.classList.contains('search-btn')) {
        searchBtn.addEventListener('click', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const activeTabEl = document.querySelector('.tabs-container .tab.active');
            const activeTab = activeTabEl ? activeTabEl.dataset.filter : 'all';
            filterBooks(activeTab, searchTerm);
        });
    }

    function filterBooks(filter, searchTerm) {
        let filteredBooks = books;

        if (filter !== 'all') {
            filteredBooks = filteredBooks.filter(book => book.category === filter);
        }

        if (searchTerm) {
            filteredBooks = filteredBooks.filter(book => 
                book.title.toLowerCase().includes(searchTerm) || 
                book.description.toLowerCase().includes(searchTerm)
            );
        }

        renderBooks(filteredBooks);
    }

    // Add CSS Keyframes for animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Initial render
    renderBooks(books);

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
            let rawQuery = deepSearchInput.value.trim().toLowerCase();
            if (!rawQuery) return;
            
            const categoryFilter = document.getElementById('deepSearchCategory') ? document.getElementById('deepSearchCategory').value : 'all';
            
            deepSearchResults.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>סורק את הספרים במאגר...</p></div>';
            
            let allResults = [];
            
            const isExactMatch = rawQuery.startsWith('"') && rawQuery.endsWith('"');
            const searchWords = isExactMatch ? [rawQuery.slice(1, -1).trim()] : rawQuery.split(/\s+/).filter(w => w.length > 0);
            
            if (searchWords.length === 0) {
                deepSearchResults.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>נא להזין מילת חיפוש חוקית.</p></div>';
                return;
            }
            
            // Iterate all books to fetch their data
            for (const b of books) {
                if (categoryFilter !== 'all' && b.category !== categoryFilter) continue;
                
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
                            
                            // Check if ALL search words exist in this chapter
                            const allExist = searchWords.every(word => lowerText.includes(word));
                            if (!allExist) return;
                            
                            // For exact match, we can find multiple occurrences.
                            // For AND search, we'll just find the first occurrence of the FIRST word to center the snippet.
                            let index = lowerText.indexOf(searchWords[0]);
                            let occurrences = 0;
                            
                            while (index !== -1 && occurrences < (isExactMatch ? 3 : 1)) {
                                const start = Math.max(0, index - 80);
                                const end = Math.min(plainText.length, index + 200); // give a bit more room for AND searches
                                
                                let snippet = plainText.substring(start, end);
                                if (start > 0) snippet = '...' + snippet;
                                if (end < plainText.length) snippet = snippet + '...';
                                
                                // Highlight all search words
                                searchWords.forEach(word => {
                                    try {
                                        // Escape special regex characters in query
                                        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                        const regex = new RegExp(`(${escapedWord})`, 'gi');
                                        // Use a temporary token to avoid replacing already added HTML tags
                                        snippet = snippet.replace(regex, '%%MARK%%$1%%ENDMARK%%');
                                    } catch(e) {
                                        console.warn("Regex highlighting failed", e);
                                    }
                                });
                                
                                snippet = snippet.replace(/%%MARK%%/g, '<mark style="background: var(--accent); color: var(--primary-bg); padding: 0 4px; border-radius: 3px;">');
                                snippet = snippet.replace(/%%ENDMARK%%/g, '</mark>');
                                
                                allResults.push({
                                    book: b,
                                    chapter: chap,
                                    snippet: snippet
                                });
                                
                                index = lowerText.indexOf(searchWords[0], index + searchWords[0].length);
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
                        <h3>לא נמצאו תוצאות עבור "${rawQuery}"</h3>
                        <p>נסה לחפש מילים אחרות, לשנות קטגוריה, או ודא שהספרים הרלוונטיים כבר נסרקו למערכת.</p>
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
                    openBookToChapter(res.book.id, res.chapter.id, rawQuery);
                });
            });
        });
    }

    
    // Nav Theme Toggle
    const navThemeToggle = document.getElementById('navThemeToggle');
    const navThemeText = document.getElementById('navThemeText');
    
    function updateThemeBtnText() {
        const text = document.body.getAttribute('data-theme') === 'dark' ? 'מצב יום' : 'מצב לילה';
        if (document.getElementById('navThemeText')) document.getElementById('navThemeText').textContent = text;
        if (document.getElementById('readerThemeText')) document.getElementById('readerThemeText').textContent = text;
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
            if (window.location.hash === '#/' || window.location.hash === '') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.location.hash = '#/';
            }
        });
    }

    // --- Audio Playback & Highlighting (Mockup) ---
    const playAudioBtn = document.getElementById('playAudioBtn');
    let synth = window.speechSynthesis;
    let isPlaying = false;
    let utterance = null;
    let originalHtml = "";
    
    if (playAudioBtn) {
        playAudioBtn.addEventListener('click', () => {
            if (isPlaying) {
                synth.cancel();
                isPlaying = false;
                playAudioBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>הקרא טקסט (ניסיון)</span>';
                if (originalHtml) {
                    textContent.innerHTML = originalHtml;
                }
                return;
            }

            // Start playing
            isPlaying = true;
            playAudioBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>עצור הקראה</span>';
            
            originalHtml = textContent.innerHTML;
            const text = textContent.innerText.trim();
            
            // Build char to word index mapping
            const words = text.split(/(\s+)/); // Keep spaces to accurately measure lengths
            let charToWord = {};
            let cleanWords = [];
            let currentWordIndex = 0;
            let currentCharIndex = 0;
            
            for(let i = 0; i < words.length; i++) {
                let part = words[i];
                if (part.trim().length > 0) {
                    cleanWords.push(part);
                    for(let j = 0; j < part.length; j++) {
                        charToWord[currentCharIndex + j] = currentWordIndex;
                    }
                    currentCharIndex += part.length;
                    currentWordIndex++;
                } else {
                    currentCharIndex += part.length; // Just spaces
                }
            }

            // Replace HTML with spans
            let spansHtml = '<div style="line-height: 2; font-size: 1.1rem;">';
            cleanWords.forEach((w, idx) => {
                spansHtml += `<span class="audio-word" id="aw-${idx}">${w}</span> `;
            });
            spansHtml += '</div>';
            textContent.innerHTML = spansHtml;

            // Setup speech
            utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'he-IL';
            utterance.rate = 0.9;
            
            // Try to find a Hebrew voice
            const voices = synth.getVoices();
            const heVoice = voices.find(v => v.lang === 'he-IL');
            if (heVoice) utterance.voice = heVoice;

            let lastWordIdx = -1;

            utterance.onboundary = (event) => {
                if (event.name !== 'word') return;
                
                const charIndex = event.charIndex;
                const wordIdx = charToWord[charIndex];
                
                if (wordIdx !== undefined && wordIdx !== lastWordIdx) {
                    // Remove highlight from previous
                    if (lastWordIdx !== -1) {
                        const prevEl = document.getElementById(`aw-${lastWordIdx}`);
                        if (prevEl) prevEl.classList.remove('word-highlight');
                    }
                    
                    // Add highlight to current
                    const currEl = document.getElementById(`aw-${wordIdx}`);
                    if (currEl) {
                        currEl.classList.add('word-highlight');
                        // Scroll into view smoothly
                        currEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    
                    lastWordIdx = wordIdx;
                }
            };

            utterance.onend = () => {
                isPlaying = false;
                playAudioBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>הקרא טקסט (ניסיון)</span>';
                textContent.innerHTML = originalHtml; // Restore original HTML
            };

            synth.speak(utterance);
        });
        
        // Handle voices changed (sometimes needed for Chrome)
        speechSynthesis.onvoiceschanged = () => {
            if(isPlaying) return; // Don't interrupt
        };
    }

    // --- Selection Context Menu & Highlighting ---
    const textContextMenu = document.getElementById('textContextMenu');
    const highlightBtn = document.getElementById('highlightBtn');
    const shareQuoteBtn = document.getElementById('shareQuoteBtn');
    const toastNotification = document.getElementById('toastNotification');
    let currentSelectionRange = null;

    if (textContent && textContextMenu) {
        // We use mouseup/touchend to check selection when user finishes selecting
        textContent.addEventListener('mouseup', (e) => {
            setTimeout(handleSelection, 10);
        });
        textContent.addEventListener('touchend', (e) => {
            setTimeout(handleSelection, 10);
        });

        function handleSelection() {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                const range = selection.getRangeAt(0);
                
                // Ensure selection is inside textContent
                if (textContent.contains(range.commonAncestorContainer)) {
                    currentSelectionRange = range.cloneRange();
                    
                    const rect = range.getBoundingClientRect();
                    
                    // Position menu centered above selection
                    textContextMenu.style.display = 'flex';
                    const menuWidth = textContextMenu.offsetWidth;
                    const menuHeight = textContextMenu.offsetHeight;
                    
                    // Small offset to avoid covering the text
                    textContextMenu.style.left = (rect.left + (rect.width / 2) - (menuWidth / 2)) + 'px';
                    textContextMenu.style.top = (rect.top - menuHeight - 15) + 'px';
                }
            } else {
                textContextMenu.style.display = 'none';
                currentSelectionRange = null;
            }
        }

        // Hide menu on mousedown outside
        document.addEventListener('mousedown', (e) => {
            if (textContextMenu && !textContextMenu.contains(e.target) && !textContent.contains(e.target)) {
                textContextMenu.style.display = 'none';
            }
        });

        if (highlightBtn) {
            highlightBtn.addEventListener('click', () => {
                if (currentSelectionRange) {
                    try {
                        const span = document.createElement('span');
                        span.className = 'highlighted-text';
                        currentSelectionRange.surroundContents(span);
                        
                        // Save highlight
                        const selectedText = currentSelectionRange.toString().trim();
                        const bookTitle = document.getElementById('readerBookTitle').textContent;
                        savedHighlights.push({
                            text: selectedText,
                            bookTitle: bookTitle,
                            date: new Date().toLocaleDateString('he-IL')
                        });
                        localStorage.setItem('savedHighlights', JSON.stringify(savedHighlights));
                        
                    } catch(e) {
                        // surroundContents fails if selection crosses node boundaries in complex ways
                        // In a real app we'd use a more robust range highlighting library
                        console.warn("Complex selection highlighting not fully supported natively");
                    }
                    
                    textContextMenu.style.display = 'none';
                    window.getSelection().removeAllRanges();
                    
                    showToast('הטקסט סומן ונשמר לאזור האישי');
                }
            });
        }

        if (shareQuoteBtn) {
            shareQuoteBtn.addEventListener('click', () => {
                if (currentSelectionRange) {
                    const selectedText = currentSelectionRange.toString().trim();
                    const bookTitle = document.getElementById('readerBookTitle').textContent;
                    
                    const textToShare = `"${selectedText}"\n\n- מתוך הספר '${bookTitle}' | הרב אשכנזי (מניטו)\nhttps://manitou.org.il`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
                    
                    window.open(whatsappUrl, '_blank');
                    
                    textContextMenu.style.display = 'none';
                    window.getSelection().removeAllRanges();
                }
            });
        }
    }

    function showToast(message) {
        if (toastNotification) {
            toastNotification.textContent = message;
            toastNotification.style.display = 'block';
            setTimeout(() => {
                toastNotification.style.display = 'none';
            }, 3000);
        }
    }

    // --- Profile Logic ---
    const openProfileBtn = document.getElementById('openProfileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModal');
    const profileTabs = document.querySelectorAll('.profile-tab');
    const profileTabContents = document.querySelectorAll('.profile-tab-content');
    const favoritesGrid = document.getElementById('favoritesGrid');
    const highlightsList = document.getElementById('highlightsList');

    window.toggleFavorite = function(bookId, btnEl) {
        const index = favoriteBooks.indexOf(bookId);
        if (index > -1) {
            favoriteBooks.splice(index, 1);
            btnEl.classList.remove('fav-active');
            btnEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
            showToast('הוסר מהמועדפים');
        } else {
            favoriteBooks.push(bookId);
            btnEl.classList.add('fav-active');
            btnEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
            showToast('נוסף למועדפים');
        }
        localStorage.setItem('favoriteBooks', JSON.stringify(favoriteBooks));
    };

    if (openProfileBtn && profileModal) {
        openProfileBtn.addEventListener('click', () => {
            window.location.hash = '#/profile';
        });

        if (closeProfileModalBtn) {
            closeProfileModalBtn.addEventListener('click', () => {
                window.location.hash = '#/';
            });
        }

        profileTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                profileTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.color = 'var(--text-muted)';
                    t.style.borderBottom = 'none';
                });
                tab.classList.add('active');
                tab.style.color = 'var(--accent)';
                tab.style.borderBottom = '2px solid var(--accent)';

                profileTabContents.forEach(content => content.style.display = 'none');
                const target = document.getElementById(tab.dataset.target);
                if (target) target.style.display = 'block';
            });
        });
    }

    function renderProfileData() {
        if (!favoritesGrid || !highlightsList) return;
        
        // Render Favorites
        favoritesGrid.innerHTML = '';
        const favs = books.filter(b => favoriteBooks.includes(b.id));
        if (favs.length === 0) {
            favoritesGrid.style.display = 'block';
            favoritesGrid.innerHTML = '<p style="color: var(--text-muted);">טרם הוספת ספרים למועדפים.</p>';
        } else {
            favoritesGrid.style.display = 'grid';
            favs.forEach(book => {
                const bgStyle = book.imgUrl ? `style="background-image: url('${book.imgUrl}'); background-size: cover; background-position: center; border-radius: 8px;"` : "";
                const overlayContent = book.imgUrl ? '' : `
                    <div class="book-title-overlay" style="border-radius: 8px;">
                        <h3>${book.title}</h3>
                        <div class="gold-line"></div>
                    </div>
                `;
                const el = document.createElement('div');
                el.style.cursor = 'pointer';
                el.innerHTML = `
                    <div class="book-cover ${book.design}" ${bgStyle} style="height: 250px;">
                        ${overlayContent}
                    </div>
                    <h4 style="margin-top: 1rem; color: var(--text-main); font-size: 1.1rem; text-align: center;">${book.title}</h4>
                `;
                el.addEventListener('click', () => {
                    profileModal.classList.remove('active');
                    openModal(book);
                });
                favoritesGrid.appendChild(el);
            });
        }

        // Render Highlights
        highlightsList.innerHTML = '';
        if (savedHighlights.length === 0) {
            highlightsList.innerHTML = '<p style="color: var(--text-muted);">טרם שמרת ציטוטים מודגשים.</p>';
        } else {
            // Reverse so newest is first
            [...savedHighlights].reverse().forEach(hl => {
                const el = document.createElement('div');
                el.style.background = 'var(--primary-bg)';
                el.style.padding = '1.5rem';
                el.style.borderRadius = '12px';
                el.style.border = '1px solid var(--border)';
                el.innerHTML = `
                    <p style="font-size: 1.2rem; color: var(--text-main); line-height: 1.6; font-family: var(--font-serif); margin-bottom: 1rem; border-right: 4px solid var(--accent); padding-right: 1rem;">
                        "${hl.text}"
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: var(--text-muted);">
                        <span>מתוך: <strong style="color: var(--accent);">${hl.bookTitle}</strong></span>
                        <span>${hl.date}</span>
                    </div>
                `;
                highlightsList.appendChild(el);
            });
        }
    }

    // --- Search Navigation & Highlighting Helper Functions ---
    window.openBookToChapter = async function(bookId, chapterId, searchQuery, searchMode = 'and') {
        const book = books.find(b => Number(b.id) === Number(bookId));
        if (!book) return;
        
        // Close modal if open
        const modal = document.getElementById('bookModal');
        if (modal) modal.classList.remove('active');
        
        // Close deep search modal if open
        const deepSearchModal = document.getElementById('deepSearchModal');
        if (deepSearchModal) {
            deepSearchModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
        
        // Open reader and load chapter
        await openReader(book, Number(chapterId));
        
        // Highlight and scroll to the searched words
        if (searchQuery) {
            setTimeout(() => {
                window.highlightAndScrollToText(searchQuery, searchMode);
            }, 150);
        }
    };

    window.highlightAndScrollToText = function(searchQuery, searchMode = 'and') {
        const contentArea = document.getElementById('textContent');
        if (!contentArea) return;
        
        let rawQuery = searchQuery.trim().toLowerCase();
        if (!rawQuery) return;
        
        const isExactMatch = rawQuery.startsWith('"') && rawQuery.endsWith('"');
        let searchWords = isExactMatch ? [rawQuery.slice(1, -1).trim()] : rawQuery.split(/\s+/).filter(w => w.length > 0);
        if (searchMode === 'exact_word') {
            searchWords = [rawQuery];
        }
        
        if (searchWords.length === 0) return;
        
        // Clean up any previous highlights
        const previousHighlights = contentArea.querySelectorAll('.search-highlight');
        previousHighlights.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize(); // merge adjacent text nodes
            }
        });

        const textNodes = [];
        const walk = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walk.nextNode()) {
            const parent = node.parentNode;
            if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.classList.contains('glossary-tooltip') || parent.tagName === 'MARK' || parent.classList.contains('audio-word'))) {
                continue;
            }
            textNodes.push(node);
        }
        
        let firstMarkedElement = null;
        
        // Traverse backwards
        textNodes.forEach(node => {
            const parent = node.parentNode;
            if (!parent) return;
            
            const text = node.textContent;
            let lowerText = text.toLowerCase();
            
            let hasMatch = false;
            if (searchMode === 'exact_word') {
                const escapedWord = searchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'i');
                if (regex.test(lowerText)) hasMatch = true;
            } else {
                searchWords.forEach(word => {
                    if (lowerText.includes(word)) hasMatch = true;
                });
            }
            
            if (!hasMatch) return;
            
            const escapedWords = searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            escapedWords.sort((a, b) => b.length - a.length);
            
            let regex;
            if (searchMode === 'exact_word') {
                regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])(${escapedWords[0]})(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'gi');
            } else {
                const regexPattern = `(${escapedWords.join('|')})`;
                regex = new RegExp(regexPattern, 'gi');
            }
            
            const parts = text.split(regex);
            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    const isPartMatch = searchMode === 'exact_word'
                        ? (part.toLowerCase() === searchWords[0])
                        : (searchWords.some(w => w.toLowerCase() === part.toLowerCase()));
                    if (isPartMatch) {
                        const mark = document.createElement('mark');
                        mark.className = 'search-highlight';
                        mark.style.background = 'rgba(212, 175, 55, 0.4)';
                        mark.style.borderBottom = '2px solid var(--accent)';
                        mark.style.color = 'var(--text-main)';
                        mark.style.padding = '2px 4px';
                        mark.style.borderRadius = '3px';
                        mark.style.fontWeight = 'bold';
                        mark.textContent = part;
                        fragment.appendChild(mark);
                        
                        if (!firstMarkedElement) {
                            firstMarkedElement = mark;
                        }
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                parent.replaceChild(fragment, node);
            }
        });
        
        if (firstMarkedElement) {
            setTimeout(() => {
                firstMarkedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    };

    // --- Mobile Navigation Drawer Logic ---
    if (hamburgerBtn && mobileDrawer && drawerOverlay) {
        hamburgerBtn.addEventListener('click', () => {
            mobileDrawer.classList.add('active');
            drawerOverlay.classList.add('active');
        });
    }

    if (closeDrawerBtn && mobileDrawer && drawerOverlay) {
        closeDrawerBtn.addEventListener('click', () => {
            mobileDrawer.classList.remove('active');
            drawerOverlay.classList.remove('active');
        });
    }

    if (drawerOverlay && mobileDrawer) {
        drawerOverlay.addEventListener('click', () => {
            mobileDrawer.classList.remove('active');
            drawerOverlay.classList.remove('active');
        });
    }

    document.querySelectorAll('.drawer-link').forEach(link => {
        link.addEventListener('click', () => {
            if (mobileDrawer) mobileDrawer.classList.remove('active');
            if (drawerOverlay) drawerOverlay.classList.remove('active');
        });
    });

    if (drawerProfileBtn) {
        drawerProfileBtn.addEventListener('click', () => {
            if (mobileDrawer) mobileDrawer.classList.remove('active');
            if (drawerOverlay) drawerOverlay.classList.remove('active');
            window.location.hash = '#/profile';
        });
    }

    if (drawerThemeToggle) {
        drawerThemeToggle.addEventListener('click', () => {
            if (document.body.getAttribute('data-theme') === 'dark') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            updateThemeBtnText();
        });
    }

    // --- Client-Side Hash Router ---
    async function handleRoute() {
        const hash = window.location.hash || '#/';
        
        // Close modal and reader modes by default
        modal.classList.remove('active');
        profileModal.classList.remove('active');
        readerMode.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Also close mobile drawers/overlays if they are open
        if (mobileDrawer) mobileDrawer.classList.remove('active');
        if (drawerOverlay) drawerOverlay.classList.remove('active');
        
        // Update active class on nav links & drawer links
        document.querySelectorAll('.nav-links a, .drawer-link').forEach(link => {
            link.classList.remove('active');
        });
        
        if (hash === '#/' || hash === '') {
            const mainLibraryLink = document.querySelector('.nav-links a[href="#/"]');
            const drawerLibraryLink = document.getElementById('drawer-link-library');
            if (mainLibraryLink) mainLibraryLink.classList.add('active');
            if (drawerLibraryLink) drawerLibraryLink.classList.add('active');
            
            filterBooks('all', searchInput.value.toLowerCase());
            
        } else if (hash.startsWith('#/book/')) {
            const bookId = Number(hash.split('#/book/')[1]);
            const book = books.find(b => b.id === bookId);
            if (book) {
                filterBooks('all', searchInput.value.toLowerCase());
                openModal(book);
            } else {
                window.location.hash = '#/';
            }
        } else if (hash.startsWith('#/reader/')) {
            const pathParts = hash.split('/');
            const bookId = Number(pathParts[2]);
            const book = books.find(b => b.id === bookId);
            
            if (book) {
                let targetChapterId = null;
                if (pathParts[3] === 'chapter' && pathParts[4]) {
                    targetChapterId = Number(pathParts[4]);
                }
                await openReader(book, targetChapterId);
                
                // If there's a search query, highlight it
                if (window.tempSearchQuery) {
                    window.highlightAndScrollToText(window.tempSearchQuery, window.tempSearchMode || 'and');
                    window.tempSearchQuery = null;
                    window.tempSearchMode = null;
                }
            } else {
                window.location.hash = '#/';
            }
        } else if (hash === '#/profile') {
            filterBooks('all', searchInput.value.toLowerCase());
            profileModal.classList.add('active');
            renderProfileData();
        } else if (hash === '#/about') {
            const aboutLink = document.querySelector('.nav-links a[href="#/about"]');
            const drawerAboutLink = document.getElementById('drawer-link-about');
            if (aboutLink) aboutLink.classList.add('active');
            if (drawerAboutLink) drawerAboutLink.classList.add('active');
            
            const heroSubtitle = document.querySelector('.hero-subtitle');
            if (heroSubtitle) heroSubtitle.scrollIntoView({ behavior: 'smooth' });
        } else if (hash === '#/contact') {
            const contactLink = document.querySelector('.nav-links a[href="#/contact"]');
            const drawerContactLink = document.getElementById('drawer-link-contact');
            if (contactLink) contactLink.classList.add('active');
            if (drawerContactLink) drawerContactLink.classList.add('active');
            
            const footer = document.querySelector('footer');
            if (footer) footer.scrollIntoView({ behavior: 'smooth' });
        } else if (hash === '#/advanced-search') {
            const advSearchSection = document.getElementById('advancedSearchSection');
            if (advSearchSection) {
                advSearchSection.scrollIntoView({ behavior: 'smooth' });
                const advSearchInput = document.getElementById('advSearchInput');
                if (advSearchInput) setTimeout(() => advSearchInput.focus(), 500);
            }
        }
    }

    // Attach listener
    window.addEventListener('hashchange', handleRoute);
    
    // Initial route handling
    handleRoute();

}

// Initialize when DOM is ready
async function startApp() {
    try {
        // Try fetching from the server API first
        let response = await fetch('/api/books');
        if (!response.ok) {
            // Fallback to static catalog.json if API is unavailable or non-ok
            response = await fetch('data/catalog.json');
        }
        if (response.ok) {
            books = await response.json();
        } else {
            console.error('Failed to load books catalog from both API and static fallback');
        }
    } catch (e) {
        console.warn('API call failed, trying static catalog.json fallback...', e);
        try {
            const response = await fetch('data/catalog.json');
            if (response.ok) {
                books = await response.json();
            }
        } catch (fallbackError) {
            console.error('Fallback static fetch failed:', fallbackError);
        }
    }
    initApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
