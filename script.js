let books = [];

function initApp() {
    const booksGrid = document.getElementById('booksGrid');
    const searchInput = document.getElementById('searchInput');
    const tabs = document.querySelectorAll('.tab');
    const modal = document.getElementById('bookModal');
    const closeModal = document.getElementById('closeModal');
    const modalBody = document.getElementById('modalBody');
    const continueReadingBtn = document.getElementById('continueReadingBtn') || document.getElementById('resumeReadingBtn');

    // Mobile Drawer elements
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const drawerProfileBtn = document.getElementById('drawerProfileBtn');
    const drawerThemeToggle = document.getElementById('drawerThemeToggle');

    // Chapter cache & Shared Transcripts Archive cache
    const chapterCache = {};
    let allBooksPreloaded = false;
    let allBooksPreloadPromise = null;
    let transcriptsArchiveItems = [];
    let transcriptsArchiveLoaded = false;
    let transcriptsArchivePromise = null;
    let collapsedShelves = new Set(JSON.parse(localStorage.getItem('manitou_collapsed_shelves') || '[]'));

    // Active state tracker for keyboard shortcuts and gestures
    let activeBook = null;
    let activeChapter = null;
    let activeChaptersList = [];

    // Profile Data
    let favoriteBooks = JSON.parse(localStorage.getItem('favoriteBooks')) || [];
    let savedHighlights = JSON.parse(localStorage.getItem('savedHighlights')) || [];
    let savedNotes = JSON.parse(localStorage.getItem('savedNotes')) || [];
    let savedBookmarks = JSON.parse(localStorage.getItem('savedBookmarks')) || [];
    let readingHistory = JSON.parse(localStorage.getItem('readingHistory')) || [];
    let libraryViewMode = localStorage.getItem('manitou_library_view_mode') || 'shelves';

    function isChapterBookmarked(bookId, chapterId, pNum = null) {
        if (!bookId || !chapterId) return false;
        const key = pNum ? `${bookId}_${chapterId}_p${pNum}` : `${bookId}_${chapterId}`;
        return savedBookmarks.some(bm => bm.key === key);
    }

    function updateBookmarkButtonsState(book = activeBook, chapter = activeChapter) {
        const isBm = book && chapter ? isChapterBookmarked(book.id, chapter.id) : false;
        const readerBmBtn = document.getElementById('readerBookmarkBtn');
        const readerBmText = document.getElementById('readerBookmarkText');
        const inlineBmBtn = document.getElementById('inlineBookmarkBtn');
        if (readerBmBtn) {
            readerBmBtn.classList.toggle('is-active', isBm);
            if (readerBmText) readerBmText.textContent = isBm ? 'שמור בסימניות ✓' : 'סימנייה';
        }
        if (inlineBmBtn) {
            inlineBmBtn.classList.toggle('active', isBm);
            inlineBmBtn.innerHTML = isBm ? '🔖 שמור בסימניות ✓' : '🔖 שמור סימנייה';
        }
    }

    function toggleChapterBookmark(book = activeBook, chapter = activeChapter, pNum = null, customExcerpt = '') {
        if (!book || !chapter) return;
        const key = pNum ? `${book.id}_${chapter.id}_p${pNum}` : `${book.id}_${chapter.id}`;
        const existingIdx = savedBookmarks.findIndex(bm => bm.key === key);
        if (existingIdx > -1) {
            savedBookmarks.splice(existingIdx, 1);
            localStorage.setItem('savedBookmarks', JSON.stringify(savedBookmarks));
            updateBookmarkButtonsState(book, chapter);
            showToast('הסימנייה הוסרה');
        } else {
            const cleanTitle = typeof formatChapterDisplayTitle === 'function'
                ? formatChapterDisplayTitle(chapter.title, book)
                : chapter.title;
            savedBookmarks.push({
                key,
                bookId: book.id,
                bookTitle: book.title,
                chapterId: chapter.id,
                chapterTitle: cleanTitle,
                pNum: pNum || null,
                excerpt: customExcerpt || '',
                date: new Date().toLocaleDateString('he-IL'),
                timestamp: Date.now()
            });
            localStorage.setItem('savedBookmarks', JSON.stringify(savedBookmarks));
            updateBookmarkButtonsState(book, chapter);
            showToast(pNum ? `🔖 סימנייה נשמרה בפסקה §${pNum}!` : '🔖 הפרק נשמר בסימניות שלך!');
        }
    }

    function recordReadingHistory(book, chapter, cleanChapTitle) {
        if (!book || !chapter) return;
        const key = `${book.id}_${chapter.id}`;
        readingHistory = readingHistory.filter(item => item.key !== key);
        const now = new Date();
        const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const dateStr = `${now.toLocaleDateString('he-IL')} • ${timeStr}`;
        readingHistory.unshift({
            key,
            bookId: book.id,
            bookTitle: book.title,
            chapterId: chapter.id,
            chapterTitle: cleanChapTitle || chapter.title,
            date: dateStr,
            timestamp: Date.now()
        });
        if (readingHistory.length > 60) {
            readingHistory = readingHistory.slice(0, 60);
        }
        localStorage.setItem('readingHistory', JSON.stringify(readingHistory));
    }

    // Read Chapters Helpers (Composite keys: "${bookId}_${chapterId}")
    function getReadChaptersList() {
        try {
            const raw = JSON.parse(localStorage.getItem('readChapters')) || [];
            return raw.filter(item => typeof item === 'string' && item.includes('_'));
        } catch (e) {
            return [];
        }
    }

    function isChapterRead(bookId, chapterId) {
        if (!bookId || !chapterId) return false;
        const list = getReadChaptersList();
        return list.includes(`${bookId}_${chapterId}`);
    }

    function setChapterRead(bookId, chapterId, isRead = true) {
        if (!bookId || !chapterId) return;
        const key = `${bookId}_${chapterId}`;
        let list = getReadChaptersList();
        if (isRead && !list.includes(key)) {
            list.push(key);
        } else if (!isRead && list.includes(key)) {
            list = list.filter(k => k !== key);
        }
        localStorage.setItem('readChapters', JSON.stringify(list));
    }

    function getBookProgress(bookId, fallbackTotal = 0) {
        const cached = chapterCache[bookId];
        const total = cached ? cached.length : (fallbackTotal || 0);
        const list = getReadChaptersList();
        const prefix = `${bookId}_`;
        const readCount = list.filter(k => k.startsWith(prefix)).length;
        const percent = total > 0 ? Math.min(100, Math.round((readCount / total) * 100)) : 0;
        return { readCount, total, percent };
    }

    // Parallel Preloader & Text Indexer for Instant Search (batched to avoid network congestion)
    async function ensureAllBooksLoaded() {
        if (allBooksPreloaded) return;
        if (allBooksPreloadPromise) return allBooksPreloadPromise;

        allBooksPreloadPromise = (async () => {
            const parserDiv = document.createElement('div');
            const batchSize = 4;
            for (let i = 0; i < books.length; i += batchSize) {
                const batch = books.slice(i, i + batchSize);
                await Promise.all(batch.map(async (b) => {
                    try {
                        let chapters = chapterCache[b.id];
                        if (!chapters) {
                            let res = await fetch(`data/book_${b.id}.json?v=19`);
                            if (!res.ok) res = await fetch(`data/book_${b.id}.json`);
                            if (!res.ok) return;
                            chapters = await res.json();
                            chapterCache[b.id] = chapters;
                        }
                        b.chaptersCount = chapters.length;
                        chapters.forEach(chap => {
                            if (chap.text && typeof chap._plainText !== 'string') {
                                parserDiv.innerHTML = chap.text;
                                const descEl = parserDiv.querySelector('[itemprop="description"]');
                                const cleanRoot = descEl || parserDiv;
                                cleanRoot.querySelectorAll('.mn-toc, .koowa_header, .vim-titleDate, .docman_download, [id^="komento"], [class*="komento"], script, style, #section-kmt, .kmt-list, .ddd').forEach(el => el.remove());
                                const plain = cleanRoot.textContent || cleanRoot.innerText || '';
                                chap._plainText = plain;
                                chap._lowerText = stripNikkud(plain.toLowerCase());
                                const paras = [];
                                let pNum = 0;
                                Array.from(cleanRoot.querySelectorAll('p, blockquote')).forEach(pEl => {
                                    if (pEl.closest('.footnotes, .chapter-footnotes-section')) return;
                                    const t = (pEl.textContent || '').replace(/\s+/g, ' ').trim();
                                    if (t.length < 35) return;
                                    pNum += 1;
                                    paras.push({
                                        pNum,
                                        text: t,
                                        lower: stripNikkud(t.toLowerCase())
                                    });
                                });
                                chap._paragraphs = paras;
                            }
                        });
                    } catch (e) {
                        // Ignore missing book files
                    }
                }));
            }
            allBooksPreloaded = true;
        })();

        return allBooksPreloadPromise;
    }

    // Shared Preloader & Indexer for External Transcripts Archive (library.manitou.org.il & manitou.org.il)
    async function ensureTranscriptsArchiveLoaded(forceReload = false) {
        if (transcriptsArchiveLoaded && !forceReload) return transcriptsArchiveItems;
        if (transcriptsArchivePromise && !forceReload) return transcriptsArchivePromise;

        transcriptsArchivePromise = (async () => {
            try {
                let res = await fetch(`/api/transcripts?_t=${forceReload ? Date.now() : 'v31'}`);
                if (!res.ok) {
                    res = await fetch(`data/transcripts_archive.json?v=31`);
                }
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.items)) {
                        transcriptsArchiveItems = data.items.map((item, idx) => {
                            const plain = (item.plainText || '').trim();
                            return {
                                ...item,
                                id: item.id || `ext_tr_${idx}`,
                                sourceGroup: item.sourceSite === 'library.manitou.org.il' ? 'library.manitou.org.il' : 'manitou.org.il',
                                plainText: plain,
                                _lowerTitle: stripNikkud((item.title || '').toLowerCase()),
                                _lowerCategory: stripNikkud((item.category || '').toLowerCase()),
                                _lowerText: stripNikkud(plain.toLowerCase())
                            };
                        });
                        transcriptsArchiveLoaded = true;
                        const spatialCountEl = document.getElementById('spatialTrCount');
                        if (spatialCountEl) {
                            spatialCountEl.textContent = `(${transcriptsArchiveItems.length})`;
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not load transcripts_archive.json:', e);
            } finally {
                transcriptsArchivePromise = null;
            }
            return transcriptsArchiveItems;
        })();

        return transcriptsArchivePromise;
    }

    // Manitou Authentic Glossary Database
    const MANITOU_GLOSSARY = [
        {
            term: "משיח בן יוסף",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "השלב החומרי, הארגוני והממלכתי של הגאולה; תחיית האומה בארצה והכנת התשתית הלאומית.",
            fullDesc: "במשנת מניטו, מייצג את הכוחות הלאומיים, הצבאיים והכלכליים של תקומת ישראל (בדומה ליוסף במצרים). זהו השלב המכין וההכרחי לפני שיכול להופיע השלב הרוחני השלם של משיח בן דוד."
        },
        {
            term: "משיח בן דוד",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "השלב הרוחני והמוסרי השלם של הגאולה; חיבור הממלכה לקודש והארת אור התורה לכל האנושות.",
            fullDesc: "לאחר שמשיח בן יוסף מכונן את התשתית הריבונית והחומרית, משיח בן דוד נושא את בשורת הצדק, המוסר, חידוש הנבואה וההארה האוניברסלית לכל משפחות האדמה."
        },
        {
            term: "ברית בין הבתרים",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "הברית ההיסטורית המבטיחה את נצחיות עם ישראל ואחיזתו בארץ דרך מסע הגלויות והתקומה.",
            fullDesc: "התחייבות א-לוהית הדדית שאינה תלויה במקריות הזמן: הבטחת הארץ לאברהם מלווה בידיעה על גלות ושעבוד, אך בסופה יציאה ברכוש גדול ותקומה נצחית בארץ המובטחת."
        },
        {
            term: "אוניברסליות לאומית",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "הפרדוקס המפרה: דווקא מתוך ייחודו הלאומי והפרטי של ישראל בארצו, בוקעת הבשורה לאנושות כולה.",
            fullDesc: "בניגוד לקוסמופוליטיות המוחקת זהויות, מניטו מלמד שרק כאשר עם ישראל נאמן לעצמיותו, לתרבותו ולארצו, הוא יכול להעניק לאנושות את תרומתו הייחודית לתיקון העולם."
        },
        {
            term: "צדק ומשפט",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "שני עמודי התווך של מוסר הנביאים: הדרישה המוסרית הפנימית ותרגומה לחוק וסדר חברתי.",
            fullDesc: "ה'צדק' הוא האמת המוסרית הבלתי מתפשרת והאחריות לחלש, וה'משפט' הוא המערכת החוקית והסוציאלית המעגנת את הצדק במציאות המדינית היומיומית."
        },
        {
            term: "קדושה וטהרה",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "טהרה היא שלילת הרע וההתרחקות מהפגם; קדושה היא חיוב החיים, קידוש החומר והמעשה הממשי.",
            fullDesc: "ביהדות הקדושה אינה פרישות או סגפנות, אלא היכולת להעלות את חיי החולין, הגוף, הכלכלה והפוליטיקה למדרגה מוסרית וא-לוהית עליונה."
        },
        {
            term: "תורה שבעל פה",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "התורה החיה המתחדשת בכל דור ודור, המתרגמת את עקרונות הנצח למציאות ההיסטורית המשתנה.",
            fullDesc: "הביטוי של השותפות בין האדם לקדוש ברוך הוא: חכמי ישראל בכל תקופה נקראים לפרש, לפתח וליישם את התורה מול האתגרים התרבותיים והמדעיים החדשים."
        },
        {
            term: "מוסר התולדות",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "העיקרון לפיו המוסר האמיתי נבחן בהשלכותיו לאורך דורות ולא רק בכוונות רגעיות.",
            fullDesc: "מעשה מוסרי אינו נמדד רק ברגש היפה של הרגע, אלא בפרי שהוא מוליד בהיסטוריה האנושית ובהשפעתו על התקדמות הצדק בעולם."
        },
        {
            term: "ממלכת כהנים",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "ייעודו של עם ישראל: להיות כהן ומורה דרך מוסרי לאנושות כולה.",
            fullDesc: "כשם שהכהן משרת את העם בבית המקדש, כך עם ישראל כולו בארצו נועד לשמש כהנהגה רוחנית ומוסרית המורה דרך לאנושות כולה."
        },
        {
            term: "אדם הראשון",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "השורש המשותף לכלל האנושות; אברהם אבינו ועם ישראל ממשיכים את המשימה שבה אדם כשל.",
            fullDesc: "הכישלון של אדם הראשון הביא לפירוד האנושות לעמים עובדי אלילים. בחירת אברהם וזרעו נועדה לבנות מודל של חברה מוסרית שתוביל לתיקון כל בני האדם."
        },
        {
            term: "ארץ ישראל",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "מרחב החיים הרוחני-ממשי שרק בו יכולה התורה להופיע כתרבות חיים כוללת ולא רק כדת.",
            fullDesc: "איננה מקלט בלבד אלא בית הגידול הטבעי שבו המפגש בין הרוח לחומר, בין אדם לאדמה ובין הפרט לציבור מקבל את משמעותו השלמה."
        },
        {
            term: "לשון הקודש",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "השפה העברית כשפת מהות, שבה שמו של כל דבר מבטא את שורשו הפנימי בבריאה.",
            fullDesc: "העברית איננה קוד מוסכם בלבד, אלא כלי שבו נברא העולם. שורשי המילים העבריות חושפים את הקשרים המטאפיזיים והמוסריים בין מושגים במציאות."
        },
        {
            term: "תיקון עולם",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "האחריות ההיסטורית של עם ישראל לריפוי והשלמת המציאות האנושית כולה.",
            fullDesc: "מניטו מדגיש כי מטרת היהדות אינה הצלת הנפש הפרטית של האדם בלבד, אלא הובלת האנושות כולה לתיקון הפגמים המוסריים והחברתיים של העולם והבאת שלום אמת."
        },
        {
            term: "דין ורחמים",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "שני עמודי ההנהגה הא-לוהית: מידת הדין של האחריות והאמת, ומידת הרחמים של הסבלנות והצמיחה.",
            fullDesc: "העולם נברא במידת הדין אך מתקיים במידת הרחמים המאפשרת לאדם זמן לעשות תשובה ולתקן את דרכו לפני שיפגוש את תוצאות מעשיו."
        },
        {
            term: "ערב רב",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "היסוד המתקשה לקבל את עול האחריות המוסרית והלאומית של הברית, ומעדיף חירות מופשטת.",
            fullDesc: "על פי מניטו, הערב רב אינו גזע אלא גישה תודעתית: הנטייה לרצות את היתרונות של הגאולה מבלי לקבל את חובות הנאמנות, המוסר והמשמעת של חיי קדושה לאומיים."
        },
        {
            term: "תולדות",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "מושג מרכזי המבטא את ההיסטוריה כתהליך התפתחותי ומגמתי של האנושות ושל עם ישראל אל עבר ייעודו.",
            fullDesc: "במשנת מניטו, 'תולדות' אינן סתם כרוניקה היסטורית או מקריות, אלא תהליך התפתחותי בעל כיוון ותכלית א-לוהית. דרך התולדות מתגלה המוסר הא-לוהי בתוך המציאות האנושית."
        },
        {
            term: "עברי",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "השלב הראשון בזהות: מי שנמצא 'מעבר האחר', שובר אלילים, ונושא בשורת המוסר המוחלט.",
            fullDesc: "הזהות העברית היא זהותו של אברהם אבינו – היכולת לעמוד לבד מול כל העולם, לנפץ את אלילי התקופה, ולשאת מוסר אוניברסלי מוחלט המקשר בין הקודש לחול ובין העמים."
        },
        {
            term: "ישראלי",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "השלב המדיני-ריבוני בזהות: חיבור המוסר העברי לממלכתיות, לאדמה ולחיי עם שלם בארצו.",
            fullDesc: "זהות 'ישראל' מסמלת את המעבר מחיי יחיד או משפחה לעם בעל ריבונות לאומית וממלכתית בארץ ישראל, המממש תורה כחוקת חיים כוללת."
        },
        {
            term: "יהודי",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "השלב הגלותי בהיסטוריה: שימור הגחלת והזהות הדתית בתנאי פיזור, עד לשיבה לזהות הישראלית.",
            fullDesc: "מקורו בשבט יהודה ששרד את החורבן. אצל מניטו, מצב הישרדותי של עם בגלות שהתכנס לתוך דת. עם שיבת ציון, על היהודי לשוב ולהיות עברי וישראלי בארצו."
        },
        {
            term: "זהות",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "מהות האדם והאומה מבפנים, מתוך מקורותיה העצמיים, ולא רק כהגדרה שלילית של אויבים.",
            fullDesc: "מניטו יצא בתוקף נגד התפיסה האקזיסטנציאליסטית לפיה האנטישמיות מגדירה את היהודי. הזהות הישראלית היא חיובית, שורשית ונובעת מהברית הא-לוהית והזיכרון ההיסטורי."
        },
        {
            term: "גאולה",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "תהליך היסטורי הדרגתי (קמעה קמעה) של חזרת העם לארצו, לשפתו, לריבונותו ולתפקידו.",
            fullDesc: "הגאולה איננה נס קסום המתרחש בן רגע, אלא התרחשות ממשית בתוך ההיסטוריה שבה בני האדם הם שותפים פעילים במעשיהם ליישוב הארץ ולבניין החברה."
        },
        {
            term: "תשובה",
            category: "morality",
            catName: "תורה ומוסר",
            shortDef: "שיבה אל השורש והזהות העצמית האמיתית של האדם והאומה, מעבר לחרטה על חטא נקודתי.",
            fullDesc: "אצל מניטו, תשובה היא 'שיבה' – חזרה של האדם אל האמת הפנימית שלו, וחזרה של עם ישראל לארצו, לייעודו המוסרי ולברית עם בוראו."
        },
        {
            term: "גלות",
            category: "identity",
            catName: "זהות ותולדות",
            shortDef: "מצב לא-טבעי של עקירה, שבו העם מפוזר ותורתו מצומצמת לפרט ולבית הכנסת.",
            fullDesc: "הגלות היא מחלה היסטורית שממנה יש להירפא. בגלות נעדרו הריבונות, האחריות החברתית והיכולת לממש את מוסר הנביאים בזירה הציבורית והמדינית."
        },
        {
            term: "ציונות",
            category: "redemption",
            catName: "גאולה ומשיחיות",
            shortDef: "התנועה ההיסטורית של תחיית העם בארצו, המהווה שלב הכרחי בדרך למימוש ייעודו המוסרי.",
            fullDesc: "מניטו ראה בציונות את המכשיר ההיסטורי של הגאולה בדורנו – שלב 'משיח בן יוסף' של קיבוץ גלויות והקמת בית לאומי, המכשיר את הקרקע לשלב הרוחני השלם."
        }
    ];
    
    // Resume Reading Button Helper
    function updateResumeReadingButton() {
        const lastReadBookId = localStorage.getItem('lastReadBookId');
        const lastReadChapterId = localStorage.getItem('lastReadChapterId');
        const lastReadBookTitle = localStorage.getItem('lastReadBookTitle');
        const lastReadChapterTitle = localStorage.getItem('lastReadChapterTitle');
        const btn = document.getElementById('resumeReadingBtn') || document.getElementById('continueReadingBtn');
        const textSpan = document.getElementById('resumeReadingText');
        
        if (lastReadBookId && btn) {
            btn.style.display = 'inline-flex';
            if (textSpan && lastReadBookTitle) {
                textSpan.textContent = `המשך קריאה: ${lastReadBookTitle}`;
                btn.title = `המשך מ: ${lastReadBookTitle}${lastReadChapterTitle ? ' • ' + lastReadChapterTitle : ''}`;
            }
            btn.onclick = () => {
                const book = books.find(b => String(b.id) === String(lastReadBookId));
                if (book) {
                    openReader(book, lastReadChapterId ? Number(lastReadChapterId) : null);
                }
            };
        }
    }
    updateResumeReadingButton();

    // --- Daily Insight Card Logic ---
    const manitouQuotes = [
        {
            quote: "הזהות הישראלית איננה מסתכמת בדת, אלא היא מהות אנושית כוללת – להיות עברי זה לקחת אחריות מוסרית על העולם.",
            source: "מספד למשיח"
        },
        {
            quote: "התולדות אינן רצף של מקרים עיוורים, אלא מהלך התפתחותי של גילוי האדם את עצמו ואת ייעודו האוניברסלי.",
            source: "סוד מדרש התולדות"
        },
        {
            quote: "ישראל הוא לב האנושות; כשהלב בריא ופועם בארצו, כל האנושות כולה מקבלת חיים וטהרה.",
            source: "שיעורים בספר בראשית"
        },
        {
            quote: "האחדות איננה טשטוש ההבדלים, אלא שיתוף הפעולה ההרמוני וההכרחי בין כל כוחות האומה השונים.",
            source: "מספד למשיח"
        },
        {
            quote: "להיות יהודי פירושו לחיות את תודעת הנצח והשליחות בתוך המציאות ההיסטורית והפוליטית הממשית.",
            source: "סוד העברי"
        },
        {
            quote: "הנבואה איננה ניבוי עתידות קסום, אלא הבנה עמוקה של חוקי המוסר הנצחיים המניעים את ההיסטוריה.",
            source: "עולם המחשבה של מניטו"
        }
    ];

    let currentQuoteIndex = 0;
    try {
        const today = new Date();
        const start = new Date(today.getFullYear(), 0, 0);
        const dayOfYear = Math.floor((today - start) / 86400000);
        currentQuoteIndex = Math.abs(dayOfYear) % manitouQuotes.length;
    } catch(e) {
        currentQuoteIndex = 0;
    }

    function renderDailyInsight() {
        const quoteEl = document.getElementById('dailyInsightQuote');
        const sourceEl = document.getElementById('dailyInsightSource');
        if (!quoteEl || !sourceEl) return;
        
        const q = manitouQuotes[currentQuoteIndex];
        quoteEl.style.opacity = '0';
        setTimeout(() => {
            quoteEl.textContent = `"${q.quote}"`;
            sourceEl.innerHTML = `מתוך: <strong>${q.source}</strong>`;
            quoteEl.style.opacity = '1';
        }, 150);
    }
    renderDailyInsight();

    const nextInsightBtn = document.getElementById('nextInsightBtn');
    if (nextInsightBtn) {
        nextInsightBtn.addEventListener('click', () => {
            currentQuoteIndex = (currentQuoteIndex + 1) % manitouQuotes.length;
            renderDailyInsight();
        });
    }

    const shareInsightWhatsappBtn = document.getElementById('shareInsightWhatsappBtn');
    if (shareInsightWhatsappBtn) {
        shareInsightWhatsappBtn.addEventListener('click', () => {
            const q = manitouQuotes[currentQuoteIndex];
            const text = `"${q.quote}"\n\n— הרב יהודא לאון אשכנזי (מניטו), מתוך: ${q.source}\nאתר תורת מניטו: ${window.location.origin}`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
        });
    }

    const copyInsightBtn = document.getElementById('copyInsightBtn');
    if (copyInsightBtn) {
        copyInsightBtn.addEventListener('click', async () => {
            const q = manitouQuotes[currentQuoteIndex];
            const text = `"${q.quote}" — הרב יהודא לאון אשכנזי (מניטו), מתוך: ${q.source}`;
            try {
                await navigator.clipboard.writeText(text);
                showToast('הציטוט הועתק ללוח בהצלחה!');
            } catch (e) {
                showToast('הציטוט הועתק');
            }
        });
    }

    const SERIES_SHELVES_CONFIG = [
        {
            id: 'סוד מדרש התולדות',
            icon: '🏛️',
            title: 'סדרת סוד מדרש התולדות',
            subtitle: '10 כרכים • היסטוריה, זהות ומוסר התולדות בספר בראשית ובתנ״ך'
        },
        {
            id: 'שערי דמעה',
            icon: '🕯️',
            title: 'סדרת שערי דמעה',
            subtitle: '3 כרכים • פרקי הגות על השואה, הגלות, התקומה וזיכרון ישראל'
        },
        {
            id: 'סוד העברי',
            icon: '📜',
            title: 'סדרת סוד העברי',
            subtitle: '2 כרכים • יסודות הזהות העברית, הישראלית והיהודית'
        },
        {
            id: 'סוד לשון הקודש',
            icon: '🔤',
            title: 'סדרת סוד לשון הקודש',
            subtitle: '2 כרכים • מטאפיזיקה ופילוסופיה של השפה העברית ואותיות הבריאה'
        },
        {
            id: 'מועדי ישראל',
            icon: '🍷',
            title: 'מועדי ישראל וקול המועד',
            subtitle: '2 כרכים • מחזור הזמנים, החגים והמועדים במשנת מניטו'
        },
        {
            id: 'ספרי יסוד ושיעורים',
            icon: '✨',
            title: 'ספרי יסוד, קבלה ושיעורים',
            subtitle: 'מספד למשיח, הדיבור והכתב, שיעורים בקבלה ומאמרים'
        },
        {
            id: 'כתבים בצרפתית',
            icon: '🌍',
            title: 'כתבים ושיעורים בצרפתית (FR)',
            subtitle: 'La Parole et l’Écrit & Leçons sur la Genèse'
        }
    ];

    function createBookCardElement(book, index) {
        const delay = Math.min(index * 0.035, 0.45);
        const bookEl = document.createElement('div');
        bookEl.className = 'book-card';
        bookEl.style.animation = `fadeInUp 0.55s ease ${delay}s backwards`;

        const bgStyle = book.imgUrl ? `style="background-image: url('${book.imgUrl}'); background-size: cover; background-position: center;"` : "";
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

        const { readCount, total, percent } = getBookProgress(book.id, book.chaptersCount || 0);
        const chaptersBadgeHtml = total > 0
            ? `<span class="book-chapters-badge" title="${total} פרקים בספר">📚 ${total} פרקים</span>`
            : '';
        const volBadgeHtml = book.seriesVol
            ? `<span class="book-vol-badge" title="${book.series} • כרך ${book.seriesVol}">כרך ${book.seriesVol}</span>`
            : '';

        const progressHtml = (total > 0 && readCount > 0)
            ? `
                <div class="book-progress-wrap">
                    <div class="book-progress-header">
                        <span>נקראו ${readCount} מתוך ${total} פרקים</span>
                        <span class="progress-pct">${percent}%</span>
                    </div>
                    <div class="book-progress-track">
                        <div class="book-progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
            `
            : '';

        bookEl.innerHTML = `
            <button class="fav-btn ${favIconClass}" data-id="${book.id}" title="הוסף למועדפים">
                ${heartSvg}
            </button>
            ${volBadgeHtml}
            <div class="book-cover ${book.design}" ${bgStyle}>
                <div class="book-spine-effect"></div>
                ${overlayContent}
                <button class="read-btn">${readCount > 0 ? 'המשך לימוד' : 'פתח ספר'}</button>
            </div>
            <div class="book-info">
                <div class="book-meta-row">
                    <span class="book-category" style="margin-bottom:0;">${book.categoryLabel}</span>
                    ${chaptersBadgeHtml}
                </div>
                <h4 class="book-name">${book.title}</h4>
                <p class="book-desc">${book.description}</p>
                ${progressHtml}
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
            window.location.hash = `#/book/${book.id}`;
        });
        return bookEl;
    }

    // Render Books (supports both 'shelves' view grouped by series and flat 'grid' view)
    function renderBooks(booksToRender) {
        booksGrid.innerHTML = '';

        const viewModeShelvesBtn = document.getElementById('viewModeShelvesBtn');
        const viewModeGridBtn = document.getElementById('viewModeGridBtn');
        const shelfStrip = document.getElementById('spatialSeriesJumps');
        const seriesSelectEl = document.getElementById('seriesFilterSelect');
        if (viewModeShelvesBtn && viewModeGridBtn) {
            viewModeShelvesBtn.classList.toggle('active', libraryViewMode === 'shelves');
            viewModeGridBtn.classList.toggle('active', libraryViewMode === 'grid');
        }
        if (shelfStrip) {
            shelfStrip.style.display = libraryViewMode === 'shelves' ? 'flex' : 'none';
        }
        if (seriesSelectEl) {
            seriesSelectEl.style.display = libraryViewMode === 'grid' ? 'inline-block' : 'none';
        }

        if (booksToRender.length === 0) {
            booksGrid.classList.remove('shelves-mode');
            booksGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h3>לא נמצאו ספרים תואמים לחיפוש</h3>
                </div>
            `;
            return;
        }

        if (libraryViewMode === 'shelves') {
            booksGrid.classList.add('shelves-mode');
            const usedIds = new Set();

            SERIES_SHELVES_CONFIG.forEach((shelfCfg) => {
                const shelfBooks = booksToRender
                    .filter(b => b.series === shelfCfg.id)
                    .sort((a, b) => (a.seriesVol || a.id) - (b.seriesVol || b.id));
                if (shelfBooks.length === 0) return;

                shelfBooks.forEach(b => usedIds.add(b.id));

                let shelfReadChapters = 0;
                let shelfTotalChapters = 0;
                shelfBooks.forEach(b => {
                    const prog = getBookProgress(b.id, b.chaptersCount || 0);
                    shelfReadChapters += prog.readCount;
                    shelfTotalChapters += prog.total;
                });
                const shelfPct = shelfTotalChapters > 0 ? Math.min(100, Math.round((shelfReadChapters / shelfTotalChapters) * 100)) : 0;

                const isShelfCollapsed = collapsedShelves.has(shelfCfg.id);
                const shelfSection = document.createElement('section');
                shelfSection.className = `bookshelf-group${isShelfCollapsed ? ' is-collapsed' : ''}`;
                shelfSection.dataset.shelfId = shelfCfg.id;
                shelfSection.innerHTML = `
                    <div class="bookshelf-header">
                        <div class="bookshelf-title-wrap">
                            <span class="bookshelf-icon">${shelfCfg.icon}</span>
                            <div>
                                <div class="bookshelf-title-row">
                                    <h3 class="bookshelf-title">${shelfCfg.title}</h3>
                                    <span class="bookshelf-count-pill">${shelfBooks.length} כרכים • ${shelfTotalChapters} פרקים</span>
                                </div>
                                <p class="bookshelf-subtitle">${shelfCfg.subtitle}</p>
                            </div>
                        </div>
                        <div class="bookshelf-header-end">
                            <div class="bookshelf-progress-box">
                                <div class="bookshelf-progress-meta">
                                    <span>התקדמות בסדרה: <strong>${shelfReadChapters}/${shelfTotalChapters}</strong> פרקים</span>
                                    <span class="bookshelf-progress-pct">${shelfPct}%</span>
                                </div>
                                <div class="bookshelf-progress-track">
                                    <div class="bookshelf-progress-fill" style="width: ${shelfPct}%;"></div>
                                </div>
                            </div>
                            <button type="button" class="bookshelf-collapse-btn" title="כווץ או פתח מדף סדרה לגלילה נוחה" aria-expanded="${!isShelfCollapsed}">
                                <span class="collapse-chevron">▾</span>
                            </button>
                        </div>
                    </div>
                    <div class="bookshelf-cards-grid"></div>
                `;
                const collapseBtn = shelfSection.querySelector('.bookshelf-collapse-btn');
                if (collapseBtn) {
                    collapseBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const nextCollapsed = !shelfSection.classList.contains('is-collapsed');
                        shelfSection.classList.toggle('is-collapsed', nextCollapsed);
                        collapseBtn.setAttribute('aria-expanded', String(!nextCollapsed));
                        if (nextCollapsed) collapsedShelves.add(shelfCfg.id);
                        else collapsedShelves.delete(shelfCfg.id);
                        localStorage.setItem('manitou_collapsed_shelves', JSON.stringify(Array.from(collapsedShelves)));
                    });
                }
                const innerGrid = shelfSection.querySelector('.bookshelf-cards-grid');
                shelfBooks.forEach((book, idx) => {
                    innerGrid.appendChild(createBookCardElement(book, idx));
                });
                booksGrid.appendChild(shelfSection);
            });

            // Any remaining books without a matching series config
            const leftover = booksToRender.filter(b => !usedIds.has(b.id));
            if (leftover.length > 0) {
                const shelfSection = document.createElement('section');
                shelfSection.className = 'bookshelf-group';
                shelfSection.innerHTML = `
                    <div class="bookshelf-header">
                        <div class="bookshelf-title-wrap">
                            <span class="bookshelf-icon">📚</span>
                            <div>
                                <h3 class="bookshelf-title">כרכים נוספים בספרייה</h3>
                            </div>
                        </div>
                    </div>
                    <div class="bookshelf-cards-grid"></div>
                `;
                const innerGrid = shelfSection.querySelector('.bookshelf-cards-grid');
                leftover.forEach((book, idx) => {
                    innerGrid.appendChild(createBookCardElement(book, idx));
                });
                booksGrid.appendChild(shelfSection);
            }
            return;
        }

        booksGrid.classList.remove('shelves-mode');
        booksToRender.forEach((book, index) => {
            booksGrid.appendChild(createBookCardElement(book, index));
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

        const { readCount, total, percent } = getBookProgress(book.id, book.chaptersCount || 0);

        modalBody.innerHTML = `
            <div class="modal-cover ${book.design}" ${bgStyle}>
                <div class="book-spine-effect"></div>
                ${overlayContent}
            </div>
            <div class="modal-info">
                <div class="modal-category">${book.categoryLabel}${total > 0 ? ` • ${total} פרקים` : ''}</div>
                <h2 class="modal-title">${book.title}</h2>
                <p class="modal-desc">${book.description}</p>
                
                <div style="margin-bottom: 1.8rem;">
                    <h4 style="color: var(--text-main); margin-bottom: 0.5rem; font-family: var(--font-sans);">פרטי הספר והתקדמות</h4>
                    <ul style="color: var(--text-muted); list-style-position: inside; font-size: 0.95rem;">
                        <li>מקור: ארכיון מכון מניטו</li>
                        ${total > 0 ? `<li>מספר פרקים בספר: <strong>${total} פרקים</strong></li>` : ''}
                        ${total > 0 ? `<li>התקדמות קריאה: <strong>${readCount} מתוך ${total} פרקים (${percent}%)</strong></li>` : ''}
                    </ul>
                </div>

                <div class="modal-actions" style="flex-wrap: wrap;">
                    <button class="btn btn-primary" id="openReaderBtn">${readCount > 0 ? 'המשך קריאה בספר' : 'קרא באתר המקומי (מצב קריאה)'}</button>
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
    let readerScrollListenerAttached = false;

    async function openReader(book, targetChapterId = null) {
        // Show Reader cleanly and hide homepage navbar/chrome completely
        readerMode.style.display = 'flex';
        document.body.classList.add('reader-open');
        document.body.style.overflow = 'hidden';
        
        // Reset sidebar filter search
        const sidebarSearch = document.getElementById('sidebarChapterSearch');
        if (sidebarSearch) sidebarSearch.value = '';
        
        activeBook = book;
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
        
        // Setup Progress Bar & Circular Progress Ring Scroll Listener once
        const readerContentArea = document.querySelector('.reader-content-area');
        const progressBar = document.getElementById('readerProgressBar');
        const ringBtn = document.getElementById('readerScrollTopRingBtn');
        const ringCircle = document.getElementById('readerRingCircle');
        const ringPct = document.getElementById('readerRingPct');
        if (ringBtn && readerContentArea && !ringBtn.dataset.bound) {
            ringBtn.dataset.bound = '1';
            ringBtn.addEventListener('click', () => {
                readerContentArea.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        if (readerContentArea && !readerScrollListenerAttached) {
            readerScrollListenerAttached = true;
            readerContentArea.addEventListener('scroll', () => {
                const scrollTop = readerContentArea.scrollTop;
                const scrollHeight = readerContentArea.scrollHeight - readerContentArea.clientHeight;
                const scrollPercentage = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0;
                if (progressBar) progressBar.style.width = scrollPercentage + '%';

                // Update Floating Circular Progress Ring
                if (ringBtn) {
                    ringBtn.classList.toggle('visible', scrollTop > 220);
                }
                if (ringCircle) {
                    const circumference = 125.66;
                    const offset = circumference - (scrollPercentage / 100) * circumference;
                    ringCircle.style.strokeDashoffset = String(offset);
                }
                if (ringPct) {
                    ringPct.textContent = Math.round(scrollPercentage) + '%';
                }
                
                // Save scroll position for this book & chapter if we have activeBook and activeChapter
                if (activeBook && activeChapter) {
                    localStorage.setItem(`scroll_${activeBook.id}_${activeChapter.id}`, scrollTop);
                }
            });
        }
        
        try {
            let chapters;
            if (chapterCache[book.id] && Array.isArray(chapterCache[book.id]) && chapterCache[book.id].length > 0) {
                chapters = chapterCache[book.id];
            } else {
                let response = await fetch(`data/book_${book.id}.json?v=19`, { cache: 'no-store' });
                if (!response.ok) {
                    response = await fetch(`data/book_${book.id}.json`, { cache: 'no-store' });
                }
                if (!response.ok) {
                    response = await fetch(`/api/books/${book.id}/public-chapters`);
                }
                if (!response.ok) {
                    throw new Error(`File not found for book ${book.id} (status ${response.status})`);
                }
                chapters = await response.json();
                chapterCache[book.id] = chapters;
                book.chaptersCount = chapters.length;
            }
            
            activeChaptersList = chapters;
            if (chapters && chapters.length > 0) {
                let targetChap = chapters[0];
                if (targetChapterId) {
                    const found = chapters.find(c => Number(c.id) === Number(targetChapterId));
                    if (found) targetChap = found;
                }
                try {
                    loadChapter(targetChap, book);
                } catch (renderErr) {
                    console.error('Error rendering chapter in loadChapter:', renderErr);
                    textContent.innerHTML = `<div class="chapter-body">${targetChap.text || ''}</div>`;
                }
            } else {
                chaptersList.innerHTML = '';
                textContent.innerHTML = '<p style="text-align:center;">לא נמצאו פרקים לספר זה.</p>';
            }
        } catch (e) {
            console.error('Failed to load book JSON:', book.id, e);
            if (typeof window.checkLocalServerHealth === 'function') {
                window.checkLocalServerHealth();
            }
            const rtCfg = window.__MANITOU_CONFIG__ || {};
            const activePort = rtCfg.port || window.location.port || '3090';
            const activeOrigin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : `http://${rtCfg.host || 'localhost'}:${activePort}`;
            chaptersList.innerHTML = '';
            textContent.innerHTML = `
                <div style="text-align:center; margin-top:2rem; padding: 2rem; border: 1.5px solid rgba(239, 68, 68, 0.45); border-radius: 16px; background: rgba(239, 68, 68, 0.06);">
                    <div style="font-size: 2.6rem; margin-bottom: 0.75rem;">🔴</div>
                    <h3 style="color: #f87171; font-size: 1.55rem; margin-bottom: 0.75rem;">השרת המקומי אינו פועל (Port ${activePort} כבוי)</h3>
                    <p style="color: var(--text-main); font-size: 1.05rem; margin-top: 0.5rem;">הדפדפן לא מצליח להתחבר לשרת המקומי בכתובת <code>${activeOrigin}</code> כדי לטעון את הספר <strong>"${book.title}"</strong>.</p>
                    <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.75rem;">הפעל את השרת באפליקציית <strong>ManitouServer.app</strong> (לחץ על "הפעל שרת") או הרץ <code>node server.js</code> בטרמינל, ולאחר מכן לחץ על הכפתור למטה:</p>
                    <button class="btn btn-primary" style="margin-top: 1.4rem; padding: 0.7rem 1.6rem; font-weight: 700;" onclick="window.location.reload(true)">🔄 השרת הופעל — בדוק חיבור וטען את הספר</button>
                </div>
            `;
            const downloadBtn = document.getElementById('downloadPdfBtn');
            if(downloadBtn) downloadBtn.style.display = 'none';
            const togglePdfViewBtn = document.getElementById('togglePdfViewBtn');
            if (togglePdfViewBtn) togglePdfViewBtn.style.display = 'none';
        }
    }

    function updateSidebarProgressUI(book, totalChapters) {
        const sidebar = document.querySelector('.chapters-sidebar');
        if (!sidebar || !book) return;
        const searchContainer = sidebar.querySelector('.sidebar-search-container');

        // 1. Series Volume Switcher (if book is part of a multi-volume series)
        let seriesBox = sidebar.querySelector('.sidebar-series-switcher');
        const seriesPeers = book.series
            ? books.filter(b => b.series === book.series).sort((a, b) => (a.seriesVol || a.id) - (b.seriesVol || b.id))
            : [];
        if (seriesPeers.length > 1) {
            if (!seriesBox) {
                seriesBox = document.createElement('div');
                seriesBox.className = 'sidebar-series-switcher';
                if (searchContainer) {
                    sidebar.insertBefore(seriesBox, searchContainer);
                } else {
                    sidebar.prepend(seriesBox);
                }
            }
            const pillsHtml = seriesPeers.map(peer => {
                const isCurrent = Number(peer.id) === Number(book.id);
                const label = (peer.series === 'סוד מדרש התולדות' || peer.series === 'שערי דמעה' || peer.series === 'סוד לשון הקודש' || peer.series === 'סוד העברי')
                    ? `כרך ${peer.seriesVol}`
                    : peer.title;
                return `<button class="series-vol-btn ${isCurrent ? 'active' : ''}" data-book-id="${peer.id}" title="${peer.title}">${label}</button>`;
            }).join('');
            seriesBox.innerHTML = `
                <div class="sidebar-series-label">
                    <span>📚 סדרת ${book.series}</span>
                    <span>${seriesPeers.length} כרכים</span>
                </div>
                <div class="series-vol-pills">${pillsHtml}</div>
            `;
            seriesBox.querySelectorAll('.series-vol-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetBookId = btn.dataset.bookId;
                    if (targetBookId && Number(targetBookId) !== Number(book.id)) {
                        window.location.hash = `#/reader/${targetBookId}`;
                    }
                });
            });
        } else if (seriesBox) {
            seriesBox.remove();
        }

        // 2. Book Reading Progress Box
        let progBox = sidebar.querySelector('.sidebar-progress-box');
        if (!progBox) {
            progBox = document.createElement('div');
            progBox.className = 'sidebar-progress-box';
            if (searchContainer) {
                sidebar.insertBefore(progBox, searchContainer);
            } else {
                sidebar.prepend(progBox);
            }
        }
        const { readCount, total, percent } = getBookProgress(book.id, totalChapters);
        progBox.innerHTML = `
            <div class="sidebar-progress-top">
                <span>התקדמות בספר: <strong>${readCount}/${total}</strong></span>
                <strong>${percent}%</strong>
            </div>
            <div class="book-progress-track">
                <div class="book-progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
        `;
    }

    function formatChapterDisplayTitle(rawTitle, book = activeBook) {
        if (!rawTitle) return '';
        let t = String(rawTitle).trim();
        if (book) {
            const prefixes = [
                book.title,
                book.series,
                book.title ? book.title.replace(/\s*\(FR\)\s*/i, '').trim() : ''
            ].filter(Boolean);
            for (const p of prefixes) {
                const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp(`^${escaped}(?:\\s+\\d+)?\\s*[:\\-–—]\\s*`, 'i');
                if (re.test(t)) {
                    const stripped = t.replace(re, '').trim();
                    if (stripped.length >= 2) {
                        t = stripped;
                        break;
                    }
                }
            }
        }
        const genericRe = /^(?:שערי דמעה|סוד מדרש התולדות|סוד לשון הקודש|סוד העברי|קול המועד|מספד למשיח|הדיבור והכתב)(?:\s+\d+)?\s*[:\-–—]\s*/i;
        if (genericRe.test(t)) {
            const stripped = t.replace(genericRe, '').trim();
            if (stripped.length >= 2) t = stripped;
        }
        return t;
    }

    // Sidebar Simple View vs Detailed View Toggle (defaults to 'simple' so full chapter names are immediately clear)
    const chaptersSidebarEl = document.querySelector('.chapters-sidebar');
    const toggleSidebarSimpleViewBtn = document.getElementById('toggleSidebarSimpleViewBtn');
    const sidebarViewToggleText = document.getElementById('sidebarViewToggleText');
    let sidebarViewMode = localStorage.getItem('sidebarViewMode') || 'simple';

    function applySidebarViewMode(mode) {
        sidebarViewMode = mode;
        localStorage.setItem('sidebarViewMode', mode);
        if (chaptersSidebarEl) {
            chaptersSidebarEl.classList.toggle('sidebar-simple-view', mode === 'simple');
        }
        if (sidebarViewToggleText) {
            sidebarViewToggleText.textContent = mode === 'simple' ? '📊 הצג התקדמות' : '📋 שמות בלבד';
        }
    }
    applySidebarViewMode(sidebarViewMode);

    if (toggleSidebarSimpleViewBtn) {
        toggleSidebarSimpleViewBtn.addEventListener('click', () => {
            const nextMode = sidebarViewMode === 'simple' ? 'detailed' : 'simple';
            applySidebarViewMode(nextMode);
        });
    }

    function renderChaptersList(chapters, book = activeBook, currentChapId = activeChapter?.id) {
        chaptersList.innerHTML = '';
        if (book) {
            updateSidebarProgressUI(book, chapters.length);
        }

        chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.dataset.chapterId = chapter.id;
            const isRead = book ? isChapterRead(book.id, chapter.id) : false;
            const hasPdf = Boolean(chapter.local_pdf || chapter.pdf_url);
            const readMins = chapter.readingMinutes || (chapter.text ? Math.max(1, Math.round(chapter.text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length / 150)) : 5);
            const displayTitle = formatChapterDisplayTitle(chapter.title, book);

            if (Number(chapter.id) === Number(currentChapId)) {
                li.classList.add('active');
            }
            if (isRead) {
                li.classList.add('chapter-is-read');
            }

            li.innerHTML = `
                <div class="chapter-item-main">
                    <span class="chapter-item-num">${index + 1}</span>
                    <div class="chapter-item-text-wrap">
                        <span class="chapter-item-title" title="${chapter.title.replace(/"/g, '&quot;')}">${displayTitle}</span>
                        <div class="chapter-item-badges">
                            <span class="chapter-time-tag" title="זמן קריאה משוער: כ-${readMins} דקות">⏱️ ${readMins} דק׳</span>
                            ${hasPdf ? '<span class="chapter-pdf-tag" title="כולל קובץ PDF">PDF</span>' : ''}
                        </div>
                    </div>
                </div>
                <button class="chapter-read-toggle ${isRead ? 'is-read' : ''}" title="${isRead ? 'סומן כנקרא (לחץ לביטול)' : 'סמן פרק כנקרא'}">✓</button>
            `;

            const toggleReadBtn = li.querySelector('.chapter-read-toggle');
            if (toggleReadBtn && book) {
                toggleReadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const nowRead = !isChapterRead(book.id, chapter.id);
                    setChapterRead(book.id, chapter.id, nowRead);
                    toggleReadBtn.classList.toggle('is-read', nowRead);
                    li.classList.toggle('chapter-is-read', nowRead);
                    updateSidebarProgressUI(book, chapters.length);
                    const bottomCompleteBtn = document.getElementById('chapterBottomCompleteBtn');
                    if (bottomCompleteBtn && activeChapter && Number(activeChapter.id) === Number(chapter.id)) {
                        bottomCompleteBtn.classList.toggle('is-read', nowRead);
                        bottomCompleteBtn.innerHTML = nowRead ? '<span>✓ פרק זה סומן כנקרא</span>' : '<span>סמן פרק כנקרא</span>';
                    }
                });
            }

            li.addEventListener('click', () => {
                const targetBook = book || activeBook;
                if (targetBook) {
                    window.location.hash = `#/reader/${targetBook.id}/chapter/${chapter.id}`;
                    const chaptersSidebar = document.querySelector('.chapters-sidebar');
                    if (chaptersSidebar && window.innerWidth <= 992) {
                        chaptersSidebar.classList.remove('active');
                    }
                }
            });
            
            chaptersList.appendChild(li);
        });
    }

    // Sidebar chapters list filtering
    const sidebarChapterSearch = document.getElementById('sidebarChapterSearch');
    if (sidebarChapterSearch) {
        sidebarChapterSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const items = chaptersList.querySelectorAll('li');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    function loadChapter(chapter, book) {
        activeChapter = chapter;
        if (typeof clearChapterSearch === 'function') clearChapterSearch();
        const footnotePopover = document.getElementById('footnotePopover');
        if (footnotePopover) footnotePopover.style.display = 'none';
        
        // Track unique read chapters with composite key "${book.id}_${chapter.id}"
        if (book && chapter) {
            setChapterRead(book.id, chapter.id, true);
        }
        if (activeChaptersList && activeChaptersList.length > 0) {
            renderChaptersList(activeChaptersList, book, chapter.id);
            const activeLi = chaptersList.querySelector(`li[data-chapter-id="${chapter.id}"]`);
            if (activeLi) {
                activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
        
        // Estimate reading time (approx. 150 words per minute for Hebrew)
        const wordCount = chapter.wordCount || (chapter.text ? chapter.text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0);
        const readingTimeMin = chapter.readingMinutes || Math.max(1, Math.round(wordCount / 150));
        const cleanChapDisplayTitle = formatChapterDisplayTitle(chapter.title, book);
        readerChapterTitle.textContent = `${cleanChapDisplayTitle} • ⏱️ כ-${readingTimeMin} דק׳ קריאה`;
        
        // Save to local storage for "Continue Reading" & Reading History Timeline
        if (book) {
            localStorage.setItem('lastReadBookId', book.id);
            localStorage.setItem('lastReadChapterId', chapter.id);
            localStorage.setItem('lastReadBookTitle', book.title);
            localStorage.setItem('lastReadChapterTitle', chapter.title);
            updateResumeReadingButton();
            recordReadingHistory(book, chapter, cleanChapDisplayTitle);
            updateBookmarkButtonsState(book, chapter);
        }
        
        // Extract clean article body from [itemprop="description"] if available, stripping Joomla wrapper
        const rawContainer = document.createElement('div');
        rawContainer.innerHTML = chapter.text || '';
        const descNode = rawContainer.querySelector('[itemprop="description"]');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = descNode ? descNode.innerHTML : rawContainer.innerHTML;
        
        // Remove known comment elements, raw duplicate TOC (.mn-toc), and broken plugins
        const junkSelectors = [
            '.mn-toc',
            '.koowa_header',
            '.vim-titleDate',
            '.docman_download',
            '[id^="komento"]',
            '[class*="komento"]',
            '.buttonheading',
            '.item-page-nav',
            '.icons',
            'script',
            'style',
            '#comments',
            '.comments-area',
            '#kmt-form',
            '.kmt-wrap',
            '.timlulnew',
            '.docman_thumbnail',
            '.inCatDiff',
            'img',
            'iframe',
            '.ddd',
            'a[href*="stackideas.com"]',
            '.vim-hiden',
            '#section-kmt', 
            '.kmt-list',
            '.kmt-control-user',
            '.kmt-form-content',
            '.komento'
        ];
        
        junkSelectors.forEach(sel => {
            tempDiv.querySelectorAll(sel).forEach(el => el.remove());
        });

        // Remove duplicate leading H1/H2 if it merely repeats the chapter title
        const firstHeading = tempDiv.querySelector('h1, h2');
        if (firstHeading) {
            const fhText = firstHeading.textContent.replace(/\s+/g, ' ').trim();
            if (fhText && (chapter.title.includes(fhText) || fhText.includes(cleanChapDisplayTitle))) {
                firstHeading.remove();
            }
        }

        // Remove empty paragraphs at the very top
        Array.from(tempDiv.querySelectorAll('p')).forEach(p => {
            if (!p.textContent.replace(/\u00a0/g, '').trim() && p.children.length === 0) {
                p.remove();
            }
        });

        // --- Normalize Existing HTML Tables & Reconstruct Space-Padded Pseudo-Tables ---
        (function normalizeAndReconstructTables(rootEl) {
            // 1. Clean up existing <table> elements (remove empty layout spacer columns and legacy inline widths)
            Array.from(rootEl.querySelectorAll('table')).forEach(tbl => {
                tbl.classList.add('manitou-editorial-table');
                tbl.removeAttribute('border');
                tbl.removeAttribute('cellpadding');
                tbl.removeAttribute('cellspacing');
                tbl.removeAttribute('style');
                const rows = Array.from(tbl.querySelectorAll('tr'));
                if (rows.length > 0) {
                    const maxCols = Math.max(...rows.map(r => r.children.length));
                    for (let colIdx = maxCols - 1; colIdx >= 0; colIdx--) {
                        const isColAlwaysEmpty = rows.every(r => {
                            const cell = r.children[colIdx];
                            if (!cell) return true;
                            const txt = (cell.textContent || '').replace(/\u00a0/g, '').trim();
                            return txt.length === 0;
                        });
                        if (isColAlwaysEmpty && maxCols > 1) {
                            rows.forEach(r => {
                                if (r.children[colIdx]) r.children[colIdx].remove();
                            });
                        }
                    }
                    rows.forEach((r, rIdx) => {
                        Array.from(r.children).forEach(cell => {
                            cell.removeAttribute('style');
                            cell.removeAttribute('width');
                            if (rIdx === 0 && rows.length >= 2) {
                                const plain = (cell.textContent || '').replace(/\u00a0/g, '').trim();
                                const hasUnderline = cell.querySelector('[style*="underline"], u, strong');
                                if ((hasUnderline || plain.length < 40) && cell.tagName === 'TD' && rows.length <= 12) {
                                    // Keep as styled header cell if row 0 is a header row
                                }
                            }
                        });
                    });
                }
                if (!tbl.parentElement || !tbl.parentElement.classList.contains('manitou-table-wrap')) {
                    const wrap = document.createElement('div');
                    wrap.className = 'manitou-table-wrap';
                    tbl.parentNode.insertBefore(wrap, tbl);
                    wrap.appendChild(tbl);
                }
            });

            // 2. Helper to split a paragraph's innerHTML by runs of 3+ spaces / &nbsp; into distinct column HTML strings
            function splitParagraphIntoColumns(pEl) {
                const plain = (pEl.textContent || '').replace(/\t/g, '    ');
                const trimmedPlain = plain.replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '');
                if (!trimmedPlain || trimmedPlain.length > 220) return null;
                // Exclude footnote definitions like "[1] ..."
                if (/^\[\d+\]/.test(trimmedPlain)) return null;

                // Unwrap outer single span/strong if it wraps the entire multi-column line (e.g., <span style="text-decoration: underline;">col1   col2   col3</span>)
                let workingHtml = pEl.innerHTML.trim();
                let isHeaderHint = false;
                const singleWrapMatch = workingHtml.match(/^<(span|strong|u|b)(\s[^>]*)?>([\s\S]*)<\/\1>$/i);
                if (singleWrapMatch) {
                    const tag = singleWrapMatch[1].toLowerCase();
                    const attrs = singleWrapMatch[2] || '';
                    const inner = singleWrapMatch[3];
                    // Make sure the closing tag isn't an earlier sibling tag
                    if (!inner.toLowerCase().includes(`</${tag}>`)) {
                        if (tag === 'u' || tag === 'strong' || tag === 'b' || /underline/i.test(attrs)) {
                            isHeaderHint = true;
                        }
                        workingHtml = inner;
                    }
                }

                // Replace sequences of 3 or more spaces / &nbsp; / \u00a0 (outside HTML tags) with a column delimiter
                let inTag = false;
                let tokenized = '';
                let spaceRun = '';
                let i = 0;
                while (i < workingHtml.length) {
                    const ch = workingHtml[i];
                    if (ch === '<') {
                        if (spaceRun.length >= 3) {
                            tokenized += '|||COL_SEP|||';
                        } else {
                            tokenized += spaceRun;
                        }
                        spaceRun = '';
                        inTag = true;
                        tokenized += ch;
                        i++;
                        continue;
                    }
                    if (ch === '>') {
                        inTag = false;
                        tokenized += ch;
                        i++;
                        continue;
                    }
                    if (!inTag) {
                        if (workingHtml.slice(i, i + 6).toLowerCase() === '&nbsp;') {
                            spaceRun += '\u00a0';
                            i += 6;
                            continue;
                        }
                        if (ch === ' ' || ch === '\u00a0' || ch === '\t') {
                            spaceRun += (ch === '\t' ? '    ' : ch);
                            i++;
                            continue;
                        }
                        if (spaceRun.length >= 3) {
                            tokenized += '|||COL_SEP|||';
                        } else {
                            tokenized += spaceRun;
                        }
                        spaceRun = '';
                    }
                    tokenized += ch;
                    i++;
                }
                if (spaceRun.length > 0 && spaceRun.length < 3) {
                    tokenized += spaceRun;
                }

                let rawCols = tokenized
                    .split('|||COL_SEP|||')
                    .map(c => c.replace(/^(?:&nbsp;|\s|\u00a0)+|(?:&nbsp;|\s|\u00a0)+$/gi, '').trim())
                    .filter(c => {
                        const tmp = document.createElement('span');
                        tmp.innerHTML = c;
                        return (tmp.textContent || '').replace(/\u00a0/g, '').trim().length > 0;
                    });

                // Special case: if a column still has two numbered items separated by 2 spaces (like "4 גאולה  7 קיבוץ גלויות" in book 15 chap 5)
                if (rawCols.length >= 2) {
                    const expandedCols = [];
                    rawCols.forEach(colHtml => {
                        const subSplit = colHtml.split(/(?:&nbsp;|\u00a0|\s){2,}(?=\d+\s+[א-ת])/);
                        if (subSplit.length > 1) {
                            subSplit.forEach(s => expandedCols.push(s.trim()));
                        } else {
                            expandedCols.push(colHtml);
                        }
                    });
                    rawCols = expandedCols;
                }

                if (rawCols.length < 2 || rawCols.length > 6) return null;
                return { cols: rawCols, isHeaderHint };
            }

            // 3. Scan top-level paragraphs in rootEl (and inside any direct content containers) for consecutive multi-column rows
            function processContainerChildren(container) {
                const children = Array.from(container.children);
                let run = [];

                function flushRun() {
                    if (run.length >= 2) {
                        const maxCols = Math.max(...run.map(r => r.cols.length));
                        // Verify column count consistency
                        const wrap = document.createElement('div');
                        wrap.className = 'manitou-table-wrap';
                        const table = document.createElement('table');
                        table.className = 'manitou-editorial-table';

                        // Determine if first row is a table header
                        const firstRow = run[0];
                        const firstRowIsHeader = firstRow.isHeaderHint ||
                            (run.length >= 3 && firstRow.cols.every(c => {
                                const t = c.replace(/<[^>]+>/g, '').trim();
                                return t.length <= 36;
                            }) && /העולמות|ספירות|עקב הצמצום|מדרגות|שם הוויה|תכנון|יישום|הוראה|מציאות|לסיכום|שושלת/.test(firstRow.cols.join(' ')));

                        let startIdx = 0;
                        if (firstRowIsHeader) {
                            const thead = document.createElement('thead');
                            const tr = document.createElement('tr');
                            for (let cIdx = 0; cIdx < maxCols; cIdx++) {
                                const th = document.createElement('th');
                                th.innerHTML = (firstRow.cols[cIdx] || '').replace(/text-decoration:\s*underline;?/gi, '');
                                tr.appendChild(th);
                            }
                            thead.appendChild(tr);
                            table.appendChild(thead);
                            startIdx = 1;
                        }

                        const tbody = document.createElement('tbody');
                        for (let rIdx = startIdx; rIdx < run.length; rIdx++) {
                            const rowData = run[rIdx];
                            const tr = document.createElement('tr');
                            if (rowData.cols.length === 1 && maxCols > 1) {
                                const td = document.createElement('td');
                                td.colSpan = maxCols;
                                td.innerHTML = rowData.cols[0];
                                tr.appendChild(td);
                            } else {
                                for (let cIdx = 0; cIdx < maxCols; cIdx++) {
                                    const td = document.createElement('td');
                                    td.innerHTML = rowData.cols[cIdx] || '';
                                    tr.appendChild(td);
                                }
                            }
                            tbody.appendChild(tr);
                        }
                        table.appendChild(tbody);
                        wrap.appendChild(table);

                        const firstEl = run[0].el;
                        firstEl.parentNode.insertBefore(wrap, firstEl);
                        run.forEach(r => r.el.remove());
                    }
                    run = [];
                }

                for (let idx = 0; idx < children.length; idx++) {
                    const el = children[idx];
                    if (el.classList.contains('chapter-footnotes-section') || el.classList.contains('footnotes')) {
                        flushRun();
                        continue;
                    }
                    if (el.tagName === 'P') {
                        const parsed = splitParagraphIntoColumns(el);
                        if (parsed) {
                            // If we already have a run, check if column structure belongs to the same table or starts a new one
                            if (run.length >= 2 && parsed.isHeaderHint) {
                                flushRun();
                            }
                            run.push({ el, cols: parsed.cols, isHeaderHint: parsed.isHeaderHint });
                            continue;
                        }
                    }
                    flushRun();
                }
                flushRun();
            }

            processContainerChildren(rootEl);
        })(tempDiv);

        // --- Sacred Quotes & Source Citations Callout Styling (Torah Verses, Midrashim, Zohar, Kabbalah) ---
        (function styleSacredQuotesAndCitations(rootEl) {
            const SACRED_CITATION_REGEX = /^[\s"״'׳(\[]*(?:ספר\s+)?(?:בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל|מלכים|ישעיהו|ישעיה|ירמיהו|ירמיה|יחזקאל|הושע|יואל|עמוס|עובדיה|יונה|מיכה|נחום|חבקוק|צפניה|חגי|זכריה|מלאכי|תהילים|תהלים|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים|בראשית רבה|שמות רבה|ויקרא רבה|במדבר רבה|דברים רבה|מדרש רבה|מדרש תנחומא|תנחומא|ילקוט שמעוני|פרקי דרבי אליעזר|פרקי אבות|מסכת אבות|אבות|ספרא|ספרי|מכילתא|תוספתא|בבלי|ירושלמי|מסכת|זוהר|תיקוני זוהר|ספר היצירה|ספר הבהיר|עץ חיים|פרי עץ חיים|שער הכוונות|שער הגלגולים|תלמוד עשר ספירות|ליקוטי מוהר"ן|כוזרי|ספר הכוזרי|מורה נבוכים|רמב"ם|רמב"ן|רש"י|מהר"ל|נצח ישראל|תפארת ישראל|גבורות ה'|באר הגולה|נפש החיים)\b/i;

            // 1. Style native <blockquote> elements
            Array.from(rootEl.querySelectorAll('blockquote')).forEach(bq => {
                if (bq.closest('.chapter-footnotes-section, .footnotes')) return;
                bq.classList.add('sacred-quote-block');
            });

            // 2. Scan paragraphs for short standalone source citation lines following 1–4 quoted paragraphs
            const allParas = Array.from(rootEl.querySelectorAll('p'));
            for (let i = 0; i < allParas.length; i++) {
                const p = allParas[i];
                if (p.closest('table, .manitou-table-wrap, .chapter-footnotes-section, .footnotes, .in-chapter-toc')) continue;

                const rawText = (p.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                if (rawText.length < 4 || rawText.length > 72) continue;

                // Must match a sacred book/source name AND contain either a comma, colon, chapter/verse number, or parasha/daf reference, and NOT end with a colon (which would be a heading)
                if (rawText.endsWith(':')) continue;
                if (!SACRED_CITATION_REGEX.test(rawText)) continue;
                const hasRefMarker = /[,:־\-]|(?:\b(?:פרק|פרשה|דף|ע"א|ע"ב|הלכה|סימן|אות|שער|ענף|חלק)\b)|(?:\s[א-ת]{1,3}(?:[\s,.:־\-]+[א-ת]{1,3})?$)/.test(rawText);
                if (!hasRefMarker) continue;

                // Verify there is at least 1 valid preceding quote paragraph
                const quoteParas = [];
                let lookback = i - 1;
                while (lookback >= 0 && quoteParas.length < 4) {
                    const prevP = allParas[lookback];
                    if (prevP.parentElement !== p.parentElement) break;
                    if (prevP.classList.contains('sacred-quote-citation')) break;
                    const prevText = (prevP.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                    if (prevText.length < 15 || prevText.length > 650) break;
                    // Stop if previous paragraph is an introductory sentence ending with a colon (e.g. "וכך אומר המדרש:")
                    if (prevText.endsWith(':') && quoteParas.length > 0) break;
                    if (prevText.endsWith(':') && prevText.length < 85) break;
                    quoteParas.unshift(prevP);
                    // If only 1 paragraph or it doesn't look like a multi-verse sequence, stop after 1–3
                    if (prevText.length > 260) break;
                    lookback--;
                }

                if (quoteParas.length > 0) {
                    quoteParas.forEach((qp, idx) => {
                        qp.classList.add('sacred-quote-block');
                        if (idx === 0) qp.classList.add('sacred-quote-first');
                        if (idx === quoteParas.length - 1) qp.classList.add('sacred-quote-last');
                    });
                    p.classList.add('sacred-quote-citation');
                }
            }
        })(tempDiv);

        // Wrap loose bottom footnote paragraphs into a clean .chapter-footnotes-section box if not already in .footnotes
        if (!tempDiv.querySelector('.footnotes')) {
            const fnLinks = Array.from(tempDiv.querySelectorAll('a[id^="_ftn"]:not([id*="_ftnref"]), a[id^="fn"]:not([id*="fnref"])'));
            if (fnLinks.length > 0) {
                const firstFnPara = fnLinks[0].closest('p, div');
                if (firstFnPara && firstFnPara.parentElement === tempDiv) {
                    const fnSection = document.createElement('div');
                    fnSection.className = 'chapter-footnotes-section';
                    fnSection.innerHTML = `<div style="font-family: var(--font-sans); font-weight: 700; color: var(--accent); font-size: 0.92rem; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border); padding-bottom: 0.45rem;">הערות שוליים ומראי מקומות (${fnLinks.length})</div>`;
                    let curr = firstFnPara;
                    const toMove = [];
                    while (curr) {
                        toMove.push(curr);
                        curr = curr.nextElementSibling;
                    }
                    toMove.forEach(el => fnSection.appendChild(el));
                    tempDiv.appendChild(fnSection);
                }
            }
        }

        // --- Build In-Chapter Mini Table of Contents BEFORE Glossary Tooltips ---
        let tocBoxElement = null;
        const headingCandidates = Array.from(tempDiv.querySelectorAll('h2, h3, h4')).filter(h => {
            if (h.closest('.footnotes, .chapter-footnotes-section')) return false;
            const t = h.textContent.replace(/\[\d+\]/g, '').trim();
            return t.length > 2 && t.length < 110 && t !== chapter.title.trim() && t !== cleanChapDisplayTitle;
        });
        if (headingCandidates.length >= 2) {
            tocBoxElement = document.createElement('div');
            tocBoxElement.className = 'in-chapter-toc';
            let tocItemsHtml = '';
            headingCandidates.forEach((hEl, idx) => {
                const secId = hEl.id || `chap-sec-${idx + 1}`;
                hEl.id = secId;
                const cleanTitle = hEl.textContent.replace(/\[\d+\]/g, '').trim();
                tocItemsHtml += `<li><a href="#${secId}"><span>•</span><span>${cleanTitle}</span></a></li>`;
            });
            tocBoxElement.innerHTML = `
                <div class="in-chapter-toc-header" id="inChapterTocToggle">
                    <span>📑 ראשי פרקים בשיעור זה (${headingCandidates.length})</span>
                    <span id="inChapterTocArrow">▼</span>
                </div>
                <ul class="in-chapter-toc-list" id="inChapterTocList">
                    ${tocItemsHtml}
                </ul>
            `;
        }

        // --- Glossary Tooltips (Only in body paragraphs, max 1 highlight per term per chapter) ---
        const seenGlossaryTerms = new Set();
        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent;
                let replaced = false;
                for (const item of MANITOU_GLOSSARY) {
                    if (seenGlossaryTerms.has(item.term)) continue;
                    const regex = new RegExp(`(?<=^|[^\\u0590-\\u05FFa-zA-Z0-9])(${item.term})(?=$|[^\\u0590-\\u05FFa-zA-Z0-9])`);
                    if (regex.test(text)) {
                        text = text.replace(regex, `<span class="glossary-term" data-term="${item.term}">$1<span class="glossary-tooltip"><span class="glossary-tooltip-title">${item.term}</span><span>${item.shortDef}</span><span class="glossary-tooltip-link" onclick="window.openGlossaryModal('${item.term}')">פתח במילון המלא ↗</span></span></span>`);
                        seenGlossaryTerms.add(item.term);
                        replaced = true;
                    }
                }
                if (replaced) {
                    const span = document.createElement('span');
                    span.innerHTML = text;
                    node.replaceWith(...span.childNodes);
                }
            } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                !['SCRIPT', 'STYLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'SUP', 'BLOCKQUOTE'].includes(node.tagName) &&
                !node.classList.contains('glossary-tooltip') &&
                !node.classList.contains('footnotes') &&
                !node.classList.contains('chapter-footnotes-section') &&
                !node.classList.contains('source') &&
                !node.classList.contains('in-chapter-toc')
            ) {
                Array.from(node.childNodes).forEach(processNode);
            }
        }
        Array.from(tempDiv.childNodes).forEach(processNode);

        // --- Smart Source Citations & Cross-References Linker ---
        const CITATION_REGEX = /\(((?:בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל|מלכים|ישעיהו|ירמיהו|יחזקאל|הושע|יואל|עמוס|עובדיה|יונה|מיכה|נחום|חבקוק|צפניה|חגי|זכריה|מלאכי|תהילים|תהלים|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים|ברכות|שבת|עירובין|פסחים|יומא|סוכה|ביצה|ראש השנה|תענית|מגילה|מועד קטן|חגיגה|יבמות|כתובות|נדרים|נזיר|סוטה|גיטין|קידושין|בבא קמא|בבא מציעא|בבא בתרא|סנהדרין|מכות|שבועות|עבודה זרה|הוריות|זבחים|מנחות|חולין|בכורות|ערכין|תמורה|כריתות|מעילה|נדה|אבות|פרקי אבות|מדרש רבה|בראשית רבה|שמות רבה|ויקרא רבה|במדבר רבה|דברים רבה|תנחומא|זוהר|תיקוני זוהר|מהר"ל|נצח ישראל|גבורות ה'|תפארת ישראל|כוזרי|מורה נבוכים)\s+[^()]{1,36})\)/g;

        function processSmartSources(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const txt = node.textContent;
                if (!txt || !txt.includes('(')) return;
                if (CITATION_REGEX.test(txt)) {
                    CITATION_REGEX.lastIndex = 0;
                    const replacedHtml = txt.replace(CITATION_REGEX, (fullMatch, innerRef) => {
                        const safeRef = innerRef.trim().replace(/"/g, '&quot;');
                        return `(<span class="smart-source-ref" data-ref-type="source" data-ref-query="${safeRef}" title="לחץ לעיון במקור או לחיפוש הפסוק בכתבי מניטו">${innerRef}</span>)`;
                    });
                    if (replacedHtml !== txt) {
                        const span = document.createElement('span');
                        span.innerHTML = replacedHtml;
                        node.replaceWith(...span.childNodes);
                    }
                }
            } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                !['SCRIPT', 'STYLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'SUP', 'BUTTON'].includes(node.tagName) &&
                !node.classList.contains('glossary-term') &&
                !node.classList.contains('glossary-tooltip') &&
                !node.classList.contains('in-chapter-toc') &&
                !node.classList.contains('chapter-footnotes-section')
            ) {
                Array.from(node.childNodes).forEach(processSmartSources);
            }
        }
        Array.from(tempDiv.childNodes).forEach(processSmartSources);

        // --- Decorate Saved Highlights for this Chapter ---
        const chapterHighlights = savedHighlights.filter(hl =>
            (hl.bookId && String(hl.bookId) === String(book.id) && hl.chapterId && String(hl.chapterId) === String(chapter.id)) ||
            (hl.bookTitle === book.title && (!hl.chapterId || String(hl.chapterId) === String(chapter.id)))
        );
        if (chapterHighlights.length > 0) {
            chapterHighlights.forEach(hl => {
                if (hl.text && hl.text.length >= 3) {
                    const hlEscaped = hl.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    try {
                        const hlRegex = new RegExp(`(${hlEscaped})`, 'g');
                        const color = hl.color || 'gold';
                        tempDiv.innerHTML = tempDiv.innerHTML.replace(hlRegex, `<span class="highlighted-text highlight-${color}" title="הדגשה שמורה (${hl.date || ''})">$1</span>`);
                    } catch (e) {}
                }
            });
        }

        // --- Decorate User Notes for this Chapter ---
        const chapterNotes = savedNotes.filter(n => 
            (n.bookId && String(n.bookId) === String(book.id) && n.chapterId && String(n.chapterId) === String(chapter.id)) ||
            (n.bookTitle === book.title && n.chapterTitle === chapter.title)
        );
        if (chapterNotes.length > 0) {
            chapterNotes.forEach(noteItem => {
                if (noteItem.quote) {
                    const quoteEscaped = noteItem.quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const noteRegex = new RegExp(`(${quoteEscaped})`, 'g');
                    const noteSafeText = noteItem.note ? noteItem.note.replace(/"/g, '&quot;') : '';
                    tempDiv.innerHTML = tempDiv.innerHTML.replace(noteRegex, `<span class="has-user-note">$1<span class="note-anchor-badge" title="הערה אישית: ${noteSafeText}">📝</span></span>`);
                }
            });
        }

        // Fallback: If chapter text is empty but a PDF is available, show an embedded PDF viewer + button
        const pdfPath = chapter.local_pdf || chapter.pdf_url || null;
        const textWords = tempDiv.textContent.replace(/\s+/g, '').trim();
        if (textWords.length === 0 && pdfPath) {
            tempDiv.innerHTML = `
                <div class="embedded-pdf-container">
                    <div class="embedded-pdf-toolbar">
                        <span>📄 <strong>${chapter.title}</strong> — מהדורת PDF סרוקה</span>
                        <button class="btn btn-primary btn-sm" style="padding: 0.35rem 1rem; border-radius: 16px; font-size: 0.85rem;" onclick="window.open('${pdfPath}', '_blank')">פתח בחלון נפרד ↗</button>
                    </div>
                    <iframe class="embedded-pdf-iframe" src="${pdfPath}" title="${chapter.title}"></iframe>
                </div>
            `;
        }

        // Prepend TOC and Editorial Chapter Header at the top of the article
        // First, number substantial body paragraphs (§1, §2...) for direct paragraph deep-linking & Karaoke TTS
        let paraCounter = 0;
        Array.from(tempDiv.querySelectorAll('p, blockquote')).forEach(pEl => {
            if (pEl.closest('.in-chapter-toc, .chapter-footnotes-section, .footnotes, .embedded-pdf-container')) return;
            const cleanPText = pEl.textContent.replace(/\s+/g, ' ').trim();
            if (cleanPText.length < 35) return;
            paraCounter += 1;
            pEl.id = `p-${paraCounter}`;
            pEl.dataset.pNum = String(paraCounter);
            const anchorBtn = document.createElement('button');
            anchorBtn.type = 'button';
            anchorBtn.className = 'para-anchor-btn';
            anchorBtn.dataset.p = String(paraCounter);
            anchorBtn.title = `פסקה §${paraCounter} — לחץ להעתקת קישור ישיר לפסקה זו`;
            anchorBtn.textContent = `§${paraCounter}`;
            pEl.prepend(anchorBtn);
        });

        if (tocBoxElement) {
            tempDiv.prepend(tocBoxElement);
        }

        const chapIdx = activeChaptersList ? activeChaptersList.findIndex(c => Number(c.id) === Number(chapter.id)) : 0;
        const totalChapsInBook = activeChaptersList ? activeChaptersList.length : 1;
        const editorialHeader = document.createElement('header');
        editorialHeader.className = 'chapter-editorial-header';
        editorialHeader.innerHTML = `
            <div class="chapter-kicker-row">
                <span class="chapter-kicker-pill">📚 ${book ? book.title : ''}</span>
                <span class="chapter-kicker-meta">פרק ${chapIdx + 1} מתוך ${totalChapsInBook}</span>
                <span class="chapter-kicker-meta">•</span>
                <span class="chapter-kicker-meta">⏱️ זמן קריאה: כ-${readingTimeMin} דקות (${wordCount.toLocaleString()} מילים)</span>
            </div>
            <h1 class="chapter-main-title">${cleanChapDisplayTitle}</h1>
            <div class="chapter-quick-bar">
                <button class="chapter-quick-btn" id="inlineSplitChapterBtn" type="button">◫ לימוד בחברותא (2 פרקים זה לצד זה)</button>
                <button class="chapter-quick-btn ${book && isChapterBookmarked(book.id, chapter.id) ? 'active' : ''}" id="inlineBookmarkBtn" type="button">${book && isChapterBookmarked(book.id, chapter.id) ? '🔖 שמור בסימניות ✓' : '🔖 שמור סימנייה'}</button>
                ${pdfPath && textWords.length > 0 ? `
                    <button class="chapter-quick-btn" id="inlineTogglePdfBtn" type="button">📄 תצוגת PDF מוטמעת</button>
                    <button class="chapter-quick-btn" id="inlineSplitPdfBtn" type="button">◫ מסך מפוצל (טקסט + PDF)</button>
                ` : ''}
                ${pdfPath ? `
                    <a class="chapter-quick-btn" href="${pdfPath}" target="_blank" rel="noopener">⬇ הורד קובץ PDF מקורי</a>
                ` : ''}
                <button class="chapter-quick-btn" id="inlinePrintBtn" type="button">🖨️ הדפס פרק</button>
            </div>
        `;
        tempDiv.prepend(editorialHeader);

        // --- Append Smart Related Chapters across the Library ---
        if (Array.isArray(chapter.relatedChapters) && chapter.relatedChapters.length > 0) {
            const relSection = document.createElement('section');
            relSection.className = 'related-chapters-section';
            const cardsHtml = chapter.relatedChapters.map(rel => {
                const cleanRelTitle = rel.chapterTitle.startsWith(rel.bookTitle + ':')
                    ? rel.chapterTitle.slice(rel.bookTitle.length + 1).trim()
                    : rel.chapterTitle;
                const tagsHtml = (rel.sharedTopics || []).map(t => `<span class="related-topic-pill"># ${t}</span>`).join('');
                return `
                    <div class="related-chapter-card" data-rel-book="${rel.bookId}" data-rel-chap="${rel.chapterId}" role="button" tabindex="0">
                        <div>
                            <div class="related-chapter-book">
                                <span>📚 ${rel.bookTitle}</span>
                                <span style="color: var(--text-muted); font-weight: 500;">⏱️ ${rel.readingMinutes || 5} דק׳</span>
                            </div>
                            <div class="related-chapter-name">${cleanRelTitle}</div>
                        </div>
                        <div class="related-card-footer-row">
                            ${tagsHtml ? `<div class="related-chapter-tags">${tagsHtml}</div>` : '<div></div>'}
                            <button type="button" class="related-split-open-btn" data-split-book="${rel.bookId}" data-split-chap="${rel.chapterId}" title="פתח פרק זה במסך מפוצל לצד הפרק הנוכחי">◫ פתח בחברותא</button>
                        </div>
                    </div>
                `;
            }).join('');

            relSection.innerHTML = `
                <div class="related-chapters-header">
                    <h3 class="related-chapters-title">🔗 שיעורים קשורים והפניות משלימות במשנת מניטו</h3>
                    <span class="related-chapters-subtitle">הצלבה אוטומטית מתוך כלל ספרי הספרייה לפי נושאים ומקורות</span>
                </div>
                <div class="related-chapters-grid">
                    ${cardsHtml}
                </div>
            `;
            tempDiv.appendChild(relSection);
        }

        // --- Append Next / Previous Chapter Navigation Footer at Bottom of Chapter ---
        if (activeChaptersList && activeChaptersList.length > 0) {
            const currentIndex = activeChaptersList.findIndex(c => Number(c.id) === Number(chapter.id));
            const prevChapter = currentIndex > 0 ? activeChaptersList[currentIndex - 1] : null;
            const nextChapter = (currentIndex !== -1 && currentIndex < activeChaptersList.length - 1) ? activeChaptersList[currentIndex + 1] : null;
            const isReadNow = book ? isChapterRead(book.id, chapter.id) : true;

            // Check if there is a next volume in the same series when reaching the last chapter
            let nextSeriesBook = null;
            if (!nextChapter && book && book.series) {
                const peers = books.filter(b => b.series === book.series).sort((a, b) => (a.seriesVol || a.id) - (b.seriesVol || b.id));
                const peerIdx = peers.findIndex(p => Number(p.id) === Number(book.id));
                if (peerIdx !== -1 && peerIdx < peers.length - 1) {
                    nextSeriesBook = peers[peerIdx + 1];
                }
            }

            const bottomNav = document.createElement('div');
            bottomNav.className = 'chapter-bottom-nav';
            bottomNav.innerHTML = `
                <div class="chapter-bottom-status">
                    <div>
                        <strong style="color: var(--text-main);">סוף פרק ${currentIndex + 1} מתוך ${activeChaptersList.length}:</strong>
                        <span style="color: var(--text-muted); margin-right: 6px;">${cleanChapDisplayTitle}</span>
                    </div>
                    <button id="chapterBottomCompleteBtn" class="chapter-complete-btn ${isReadNow ? 'is-read' : ''}">
                        <span>${isReadNow ? '✓ פרק זה סומן כנקרא' : 'סמן פרק כנקרא'}</span>
                    </button>
                </div>
                <div class="chapter-nav-grid">
                    ${prevChapter ? `
                        <div class="chapter-nav-card prev-card" data-target-chap="${prevChapter.id}">
                            <div class="chapter-nav-dir">→ הפרק הקודם (פרק ${currentIndex})</div>
                            <div class="chapter-nav-title">${formatChapterDisplayTitle(prevChapter.title, book)}</div>
                        </div>
                    ` : '<div></div>'}
                    ${nextChapter ? `
                        <div class="chapter-nav-card next-card" data-target-chap="${nextChapter.id}">
                            <div class="chapter-nav-dir">הפרק הבא (פרק ${currentIndex + 2}) ←</div>
                            <div class="chapter-nav-title">${formatChapterDisplayTitle(nextChapter.title, book)}</div>
                        </div>
                    ` : (nextSeriesBook ? `
                        <div class="chapter-nav-card next-card" data-target-book="${nextSeriesBook.id}" style="border-color: var(--accent); background: rgba(212,175,55,0.08);">
                            <div class="chapter-nav-dir">המשך לכרך הבא בסדרה ←</div>
                            <div class="chapter-nav-title">📚 ${nextSeriesBook.title}</div>
                        </div>
                    ` : '')}
                </div>
            `;
            tempDiv.appendChild(bottomNav);
        }

        textContent.classList.remove('chapter-fade-enter');
        void textContent.offsetWidth;
        textContent.innerHTML = tempDiv.innerHTML;
        textContent.classList.add('chapter-fade-enter');

        // Wire up In-Chapter Mini TOC Toggle
        const tocToggle = document.getElementById('inChapterTocToggle');
        const tocList = document.getElementById('inChapterTocList');
        const tocArrow = document.getElementById('inChapterTocArrow');
        if (tocToggle && tocList) {
            tocToggle.addEventListener('click', () => {
                const isHidden = tocList.style.display === 'none';
                tocList.style.display = isHidden ? 'grid' : 'none';
                if (tocArrow) tocArrow.textContent = isHidden ? '▼' : '◀';
            });
        }

        // Wire up Bottom Navigation Cards, Related Chapter Cards, Paragraph Anchors & Complete Toggle
        textContent.querySelectorAll('.related-chapter-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const splitBtn = e.target.closest('.related-split-open-btn');
                if (splitBtn) {
                    e.stopPropagation();
                    const sb = splitBtn.dataset.splitBook;
                    const sc = splitBtn.dataset.splitChap;
                    if (sb && sc && typeof window.openSplitChapterPane === 'function') {
                        window.openSplitChapterPane(sb, sc);
                    }
                    return;
                }
                const rb = card.dataset.relBook;
                const rc = card.dataset.relChap;
                if (rb && rc) {
                    window.location.hash = `#/reader/${rb}/chapter/${rc}`;
                }
            });
        });

        textContent.querySelectorAll('.para-anchor-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pNum = btn.dataset.p;
                if (!pNum || !book) return;
                // If TTS is currently active, clicking a paragraph badge jumps speech to this paragraph!
                if (currentAudioMode === 'tts' && readerAudioPlayerBar && readerAudioPlayerBar.style.display !== 'none' && typeof window.jumpTtsToParagraphElement === 'function') {
                    const parentPara = btn.closest('[data-p-num]');
                    if (parentPara) {
                        window.jumpTtsToParagraphElement(parentPara);
                        showToast(`🗣️ מקריא החל מפסקה §${pNum}`);
                        return;
                    }
                }
                const deepHash = `#/reader/${book.id}/chapter/${chapter.id}?p=${pNum}`;
                const fullUrl = `${window.location.origin}${window.location.pathname}${deepHash}`;
                try {
                    history.replaceState(null, '', deepHash);
                } catch (err) {}
                try {
                    await navigator.clipboard.writeText(fullUrl);
                } catch (err) {}
                const parentEl = btn.closest('[data-p-num]');
                if (parentEl) {
                    parentEl.classList.add('para-flash-highlight');
                    setTimeout(() => parentEl.classList.remove('para-flash-highlight'), 2400);
                }
                showToast(`🔗 הקישור הישיר לפסקה §${pNum} הועתק ללוח!`);
            });
        });

        textContent.querySelectorAll('.chapter-nav-card').forEach(card => {
            card.addEventListener('click', () => {
                const targetChapId = card.dataset.targetChap;
                const targetBookId = card.dataset.targetBook;
                if (targetBookId) {
                    window.location.hash = `#/reader/${targetBookId}`;
                } else if (book && targetChapId) {
                    window.location.hash = `#/reader/${book.id}/chapter/${targetChapId}`;
                }
            });
        });

        const bottomCompleteBtn = document.getElementById('chapterBottomCompleteBtn');
        if (bottomCompleteBtn && book) {
            bottomCompleteBtn.addEventListener('click', () => {
                const nowRead = !isChapterRead(book.id, chapter.id);
                setChapterRead(book.id, chapter.id, nowRead);
                bottomCompleteBtn.classList.toggle('is-read', nowRead);
                bottomCompleteBtn.innerHTML = `<span>${nowRead ? '✓ פרק זה סומן כנקרא' : 'סמן פרק כנקרא'}</span>`;
                renderChaptersList(activeChaptersList, book, chapter.id);
                showToast(nowRead ? 'הפרק סומן כנקרא' : 'סימון הקריאה הוסר');
            });
        }
        
        // Restore scroll position or jump to target paragraph (?p=X)
        const savedScroll = localStorage.getItem(`scroll_${book.id}_${chapter.id}`);
        const readerContentArea = textContent.parentElement;
        if (window.pendingParagraphScroll) {
            const targetPNum = window.pendingParagraphScroll;
            window.pendingParagraphScroll = null;
            setTimeout(() => {
                const targetParaEl = textContent.querySelector(`#p-${CSS.escape(String(targetPNum))}`);
                if (targetParaEl) {
                    targetParaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetParaEl.classList.add('para-flash-highlight');
                    setTimeout(() => targetParaEl.classList.remove('para-flash-highlight'), 2800);
                }
            }, 120);
        } else if (savedScroll && !window.tempSearchQuery && readerContentArea) {
            setTimeout(() => {
                readerContentArea.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'smooth' });
            }, 80);
        } else if (readerContentArea) {
            readerContentArea.scrollTop = 0;
        }
        
        const downloadBtn = document.getElementById('downloadPdfBtn');
        const togglePdfViewBtn = document.getElementById('togglePdfViewBtn');
        const togglePdfViewText = document.getElementById('togglePdfViewText');
        const splitPdfViewBtn = document.getElementById('splitPdfViewBtn');
        const splitPdfViewText = document.getElementById('splitPdfViewText');
        const printChapterBtn = document.getElementById('printChapterBtn');
        const readerLayout = document.querySelector('.reader-layout');

        if (printChapterBtn) {
            printChapterBtn.onclick = () => window.print();
        }

        // Update or clean up active split-screen PDF pane when switching chapters
        if (readerLayout) {
            const existingSplitPane = readerLayout.querySelector('.split-pdf-pane');
            if (existingSplitPane) {
                if (pdfPath) {
                    const iframe = existingSplitPane.querySelector('iframe');
                    const headerTitle = existingSplitPane.querySelector('.split-pdf-title');
                    if (iframe) iframe.src = pdfPath;
                    if (headerTitle) headerTitle.textContent = `📄 מקור PDF: ${chapter.title}`;
                } else {
                    existingSplitPane.remove();
                    readerLayout.classList.remove('split-pdf-active');
                    if (splitPdfViewText) splitPdfViewText.textContent = 'מסך מפוצל';
                    if (splitPdfViewBtn) {
                        splitPdfViewBtn.classList.remove('btn-primary');
                        splitPdfViewBtn.classList.add('btn-secondary');
                    }
                }
            }
        }

        const readerPdfCapsule = document.getElementById('readerPdfCapsule');
        if (readerPdfCapsule) {
            readerPdfCapsule.style.display = pdfPath ? 'inline-flex' : 'none';
        }
        if (downloadBtn) {
            if (pdfPath) {
                downloadBtn.style.display = 'inline-flex';
                downloadBtn.onclick = () => window.open(pdfPath, '_blank');
            } else {
                downloadBtn.style.display = 'none';
            }
        }
        if (splitPdfViewBtn && readerLayout) {
            if (pdfPath && textWords.length > 0) {
                splitPdfViewBtn.style.display = 'inline-flex';
                splitPdfViewBtn.onclick = () => {
                    let splitPane = readerLayout.querySelector('.split-pdf-pane');
                    if (splitPane) {
                        splitPane.remove();
                        readerLayout.classList.remove('split-pdf-active');
                        if (splitPdfViewText) splitPdfViewText.textContent = 'מסך מפוצל';
                        splitPdfViewBtn.classList.remove('btn-primary');
                        splitPdfViewBtn.classList.add('btn-secondary');
                    } else {
                        splitPane = document.createElement('div');
                        splitPane.className = 'split-pdf-pane';
                        splitPane.innerHTML = `
                            <div class="split-pdf-pane-header">
                                <span class="split-pdf-title">📄 מקור PDF: ${chapter.title}</span>
                                <div style="display:flex; gap:6px;">
                                    <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem; border-radius: 10px;" onclick="window.open('${pdfPath}', '_blank')">חלון חדש ↗</button>
                                    <button class="btn btn-secondary btn-sm" id="closeSplitPdfPaneBtn" style="padding: 2px 8px; font-size: 0.75rem; border-radius: 10px;">✕</button>
                                </div>
                            </div>
                            <iframe src="${pdfPath}" title="${chapter.title}"></iframe>
                        `;
                        readerLayout.appendChild(splitPane);
                        readerLayout.classList.add('split-pdf-active');
                        if (splitPdfViewText) splitPdfViewText.textContent = 'סגור פיצול';
                        splitPdfViewBtn.classList.remove('btn-secondary');
                        splitPdfViewBtn.classList.add('btn-primary');
                        const closeSplitBtn = document.getElementById('closeSplitPdfPaneBtn');
                        if (closeSplitBtn) {
                            closeSplitBtn.onclick = () => splitPdfViewBtn.click();
                        }
                    }
                };
            } else {
                splitPdfViewBtn.style.display = 'none';
            }
        }
        if (togglePdfViewBtn) {
            if (pdfPath && textWords.length > 0) {
                togglePdfViewBtn.style.display = 'inline-flex';
                if (togglePdfViewText) togglePdfViewText.textContent = 'תצוגת PDF';
                togglePdfViewBtn.classList.remove('btn-primary');
                togglePdfViewBtn.classList.add('btn-secondary');
                togglePdfViewBtn.onclick = () => {
                    let existingPdfContainer = textContent.querySelector('.embedded-pdf-container');
                    if (existingPdfContainer) {
                        existingPdfContainer.remove();
                        if (togglePdfViewText) togglePdfViewText.textContent = 'תצוגת PDF';
                        togglePdfViewBtn.classList.remove('btn-primary');
                        togglePdfViewBtn.classList.add('btn-secondary');
                    } else {
                        const pdfBox = document.createElement('div');
                        pdfBox.className = 'embedded-pdf-container';
                        pdfBox.innerHTML = `
                            <div class="embedded-pdf-toolbar">
                                <span>📄 <strong>תצוגת PDF מוטמעת:</strong> ${chapter.title}</span>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.8rem; border-radius: 14px; font-size: 0.8rem;" onclick="window.open('${pdfPath}', '_blank')">פתח בחלון חדש ↗</button>
                                </div>
                            </div>
                            <iframe class="embedded-pdf-iframe" src="${pdfPath}" title="${chapter.title}"></iframe>
                        `;
                        textContent.prepend(pdfBox);
                        if (togglePdfViewText) togglePdfViewText.textContent = 'הסתר PDF';
                        togglePdfViewBtn.classList.remove('btn-secondary');
                        togglePdfViewBtn.classList.add('btn-primary');
                        if (readerContentArea) readerContentArea.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                };
            } else {
                togglePdfViewBtn.style.display = 'none';
            }
        }

        // Wire up Inline Quick Bar buttons inside the Chapter Editorial Header
        const inlineTogglePdfBtn = document.getElementById('inlineTogglePdfBtn');
        const inlineSplitPdfBtn = document.getElementById('inlineSplitPdfBtn');
        const inlinePrintBtn = document.getElementById('inlinePrintBtn');
        const inlineBookmarkBtn = document.getElementById('inlineBookmarkBtn');
        const inlineSplitChapterBtn = document.getElementById('inlineSplitChapterBtn');
        const readerBookmarkBtn = document.getElementById('readerBookmarkBtn');
        const splitChapterViewBtn = document.getElementById('splitChapterViewBtn');

        if (inlineBookmarkBtn) {
            inlineBookmarkBtn.onclick = () => toggleChapterBookmark(book, chapter);
        }
        if (readerBookmarkBtn) {
            readerBookmarkBtn.onclick = () => toggleChapterBookmark(book, chapter);
        }
        if (inlineSplitChapterBtn) {
            inlineSplitChapterBtn.onclick = () => {
                if (typeof window.toggleSplitChapterPane === 'function') {
                    window.toggleSplitChapterPane();
                }
            };
        }
        if (splitChapterViewBtn) {
            splitChapterViewBtn.onclick = () => {
                if (typeof window.toggleSplitChapterPane === 'function') {
                    window.toggleSplitChapterPane();
                }
            };
        }
        if (inlineTogglePdfBtn && togglePdfViewBtn) {
            inlineTogglePdfBtn.onclick = () => {
                togglePdfViewBtn.click();
                inlineTogglePdfBtn.classList.toggle('active', Boolean(textContent.querySelector('.embedded-pdf-container')));
            };
        }
        if (inlineSplitPdfBtn && splitPdfViewBtn) {
            inlineSplitPdfBtn.onclick = () => {
                splitPdfViewBtn.click();
                inlineSplitPdfBtn.classList.toggle('active', Boolean(readerLayout && readerLayout.classList.contains('split-pdf-active')));
            };
        }
        if (inlinePrintBtn) {
            inlinePrintBtn.onclick = () => window.print();
        }
    }

    // --- Dual-Chapter Split Reader ("לימוד בחברותא – שני פרקים זה לצד זה") ---
    async function fetchBookChaptersForSplit(bookId) {
        if (chapterCache[bookId]) return chapterCache[bookId];
        try {
            let res = await fetch(`data/book_${bookId}.json?v=19`);
            if (!res.ok) res = await fetch(`data/book_${bookId}.json`);
            if (res.ok) {
                const chaps = await res.json();
                chapterCache[bookId] = chaps;
                return chaps;
            }
        } catch (e) {}
        return [];
    }

    function updateSplitChapterButtonsUI(isOpen) {
        const splitChapterViewBtn = document.getElementById('splitChapterViewBtn');
        const splitChapterViewText = document.getElementById('splitChapterViewText');
        const inlineSplitChapterBtn = document.getElementById('inlineSplitChapterBtn');
        if (splitChapterViewBtn) {
            splitChapterViewBtn.classList.toggle('is-active', isOpen);
            if (splitChapterViewText) {
                splitChapterViewText.textContent = isOpen ? 'סגור חברותא ✕' : 'חברותא (2 פרקים)';
            }
        }
        if (inlineSplitChapterBtn) {
            inlineSplitChapterBtn.classList.toggle('active', isOpen);
            inlineSplitChapterBtn.textContent = isOpen ? '◫ סגור חלון חברותא ✕' : '◫ לימוד בחברותא (2 פרקים זה לצד זה)';
        }
    }

    window.closeSplitChapterPane = function() {
        const readerLayout = document.querySelector('.reader-layout');
        if (!readerLayout) return;
        const pane = readerLayout.querySelector('.split-chapter-pane');
        if (pane) pane.remove();
        readerLayout.classList.remove('split-chapter-active');
        updateSplitChapterButtonsUI(false);
    };

    window.toggleSplitChapterPane = function() {
        const readerLayout = document.querySelector('.reader-layout');
        if (!readerLayout) return;
        if (readerLayout.querySelector('.split-chapter-pane')) {
            window.closeSplitChapterPane();
        } else {
            // Pick a smart default second chapter: first relatedChapter if available, or next chapter in current book
            let defaultBookId = activeBook ? activeBook.id : (books[0] ? books[0].id : 2);
            let defaultChapId = null;
            if (activeChapter && Array.isArray(activeChapter.relatedChapters) && activeChapter.relatedChapters.length > 0) {
                defaultBookId = activeChapter.relatedChapters[0].bookId;
                defaultChapId = activeChapter.relatedChapters[0].chapterId;
            } else if (activeChaptersList && activeChaptersList.length > 1 && activeChapter) {
                const idx = activeChaptersList.findIndex(c => Number(c.id) === Number(activeChapter.id));
                const nextC = activeChaptersList[(idx + 1) % activeChaptersList.length];
                if (nextC) defaultChapId = nextC.id;
            }
            window.openSplitChapterPane(defaultBookId, defaultChapId);
        }
    };

    window.openSplitChapterPane = async function(targetBookId = null, targetChapterId = null, targetPNum = null) {
        const readerLayout = document.querySelector('.reader-layout');
        if (!readerLayout) return;

        // Close PDF split pane if open so they don't collide
        const existingPdfPane = readerLayout.querySelector('.split-pdf-pane');
        if (existingPdfPane) {
            existingPdfPane.remove();
            readerLayout.classList.remove('split-pdf-active');
        }

        const resolvedBookId = targetBookId || (activeBook ? activeBook.id : (books[0]?.id || 2));
        let pane = readerLayout.querySelector('.split-chapter-pane');
        if (!pane) {
            pane = document.createElement('aside');
            pane.className = 'split-chapter-pane';
            pane.innerHTML = `
                <div class="split-chapter-pane-header">
                    <div class="split-chapter-selectors">
                        <span class="split-pane-badge">◫ חברותא</span>
                        <select id="splitPaneBookSelect" class="split-pane-select" aria-label="בחר ספר לחלון המקביל"></select>
                        <select id="splitPaneChapterSelect" class="split-pane-select" aria-label="בחר פרק לחלון המקביל"></select>
                    </div>
                    <div class="split-chapter-actions">
                        <button type="button" id="splitPaneMakePrimaryBtn" class="split-pane-action-btn" title="הפוך פרק זה לפרק הראשי בקורא">⇄ הפוך לראשי</button>
                        <button type="button" id="closeSplitChapterPaneBtn" class="split-pane-action-btn close" title="סגור חלון חברותא">✕</button>
                    </div>
                </div>
                <div class="split-chapter-body" id="splitChapterBody"></div>
            `;
            readerLayout.appendChild(pane);
            readerLayout.classList.add('split-chapter-active');

            const closeBtn = pane.querySelector('#closeSplitChapterPaneBtn');
            if (closeBtn) closeBtn.addEventListener('click', () => window.closeSplitChapterPane());
        }

        updateSplitChapterButtonsUI(true);

        const bookSelect = pane.querySelector('#splitPaneBookSelect');
        const chapSelect = pane.querySelector('#splitPaneChapterSelect');
        const makePrimaryBtn = pane.querySelector('#splitPaneMakePrimaryBtn');
        const bodyEl = pane.querySelector('#splitChapterBody');

        // Populate book selector
        if (bookSelect && bookSelect.options.length === 0) {
            books.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.title;
                bookSelect.appendChild(opt);
            });
            bookSelect.addEventListener('change', () => {
                window.openSplitChapterPane(bookSelect.value, null);
            });
        }
        if (bookSelect) bookSelect.value = String(resolvedBookId);

        if (bodyEl) {
            bodyEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">טוען פרק מקביל...</div>`;
        }

        const splitBook = books.find(b => String(b.id) === String(resolvedBookId)) || activeBook;
        const chaps = await fetchBookChaptersForSplit(resolvedBookId);
        if (!chaps || chaps.length === 0) {
            if (bodyEl) bodyEl.innerHTML = `<div style="padding: 2rem; color: var(--text-muted);">לא נמצאו פרקים בספר זה.</div>`;
            return;
        }

        const chosenChap = (targetChapterId && chaps.find(c => String(c.id) === String(targetChapterId))) || chaps[0];

        if (chapSelect) {
            chapSelect.innerHTML = '';
            chaps.forEach((c, idx) => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${idx + 1}. ${formatChapterDisplayTitle(c.title, splitBook)}`;
                chapSelect.appendChild(opt);
            });
            chapSelect.value = String(chosenChap.id);
            chapSelect.onchange = () => {
                window.openSplitChapterPane(resolvedBookId, chapSelect.value);
            };
        }

        if (makePrimaryBtn) {
            makePrimaryBtn.onclick = () => {
                const bId = bookSelect ? bookSelect.value : resolvedBookId;
                const cId = chapSelect ? chapSelect.value : chosenChap.id;
                window.location.hash = `#/reader/${bId}/chapter/${cId}`;
            };
        }

        // Render clean chapter text into split pane
        const rawDiv = document.createElement('div');
        rawDiv.innerHTML = chosenChap.text || '';
        const descNode = rawDiv.querySelector('[itemprop="description"]');
        const cleanDiv = document.createElement('div');
        cleanDiv.innerHTML = descNode ? descNode.innerHTML : rawDiv.innerHTML;
        cleanDiv.querySelectorAll('.mn-toc, .koowa_header, .vim-titleDate, .docman_download, [id^="komento"], [class*="komento"], script, style, img, iframe, #section-kmt, .kmt-list, .ddd').forEach(el => el.remove());

        let pCount = 0;
        Array.from(cleanDiv.querySelectorAll('p, blockquote')).forEach(pEl => {
            if (pEl.closest('.footnotes, .chapter-footnotes-section')) return;
            const txt = (pEl.textContent || '').replace(/\s+/g, ' ').trim();
            if (txt.length < 35) return;
            pCount += 1;
            pEl.id = `split-p-${pCount}`;
            pEl.dataset.pNum = String(pCount);
            const badge = document.createElement('span');
            badge.className = 'para-anchor-btn';
            badge.textContent = `§${pCount}`;
            pEl.prepend(badge);
        });

        const cleanTitle = formatChapterDisplayTitle(chosenChap.title, splitBook);
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="split-chapter-title-box">
                    <div class="split-chapter-book-kicker">📚 ${splitBook ? splitBook.title : ''}</div>
                    <h2 class="split-chapter-heading">${cleanTitle}</h2>
                </div>
                <div class="split-chapter-article">${cleanDiv.innerHTML}</div>
            `;
            bodyEl.scrollTop = 0;
            if (targetPNum) {
                setTimeout(() => {
                    const targetEl = bodyEl.querySelector(`#split-p-${CSS.escape(String(targetPNum))}`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetEl.classList.add('para-flash-highlight');
                        setTimeout(() => targetEl.classList.remove('para-flash-highlight'), 2800);
                    }
                }, 120);
            }
        }
    };

    // Close Reader Mode
    backToLibrary.addEventListener('click', () => {
        const footnotePopover = document.getElementById('footnotePopover');
        if (footnotePopover) footnotePopover.style.display = 'none';
        window.location.hash = '#/';
    });

    // Helper to resolve internal anchor/footnote target element inside textContent
    function findInternalAnchorTarget(targetId) {
        if (!targetId || !textContent) return null;
        return document.getElementById(targetId) ||
               textContent.querySelector(`[name="${CSS.escape(targetId)}"], [id="${CSS.escape(targetId)}"]`);
    }

    // Interactive Footnote Popover & Smooth Anchor Scrolling inside the reader content
    const footnotePopover = document.getElementById('footnotePopover');
    let footnoteHideTimeout = null;

    function showFootnotePreview(linkEl, targetEl, targetId) {
        if (!footnotePopover || !targetEl) return;
        // Extract footnote container text (usually the parent <p> or <div> of the footnote anchor)
        const container = targetEl.closest('p, div, li') || targetEl.parentElement || targetEl;
        const rawText = (container.textContent || '').trim();
        if (!rawText || rawText.length < 2) return;

        clearTimeout(footnoteHideTimeout);
        const labelMatch = linkEl.textContent.trim() || 'הערת שוליים';
        footnotePopover.innerHTML = `
            <div class="footnote-popover-header">
                <span>הערת שוליים ${labelMatch}</span>
                <button id="closeFootnotePopoverBtn" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>
            </div>
            <div class="footnote-popover-body">${rawText}</div>
            <div class="footnote-popover-footer">
                <button class="footnote-popover-jump" id="jumpToFootnoteBtn">גלול למיקום ההערה בפרק ↓</button>
            </div>
        `;
        footnotePopover.style.display = 'block';

        const rect = linkEl.getBoundingClientRect();
        const popRect = footnotePopover.getBoundingClientRect();
        let top = rect.top - popRect.height - 10;
        if (top < 12) {
            top = rect.bottom + 10;
        }
        let left = rect.left + (rect.width / 2) - (popRect.width / 2);
        left = Math.max(16, Math.min(window.innerWidth - popRect.width - 16, left));

        footnotePopover.style.top = `${top}px`;
        footnotePopover.style.left = `${left}px`;

        const closeBtn = document.getElementById('closeFootnotePopoverBtn');
        if (closeBtn) {
            closeBtn.onclick = () => { footnotePopover.style.display = 'none'; };
        }
        const jumpBtn = document.getElementById('jumpToFootnoteBtn');
        if (jumpBtn) {
            jumpBtn.onclick = () => {
                footnotePopover.style.display = 'none';
                scrollToAndFlashElement(targetEl);
            };
        }
    }

    function scrollToAndFlashElement(targetEl) {
        if (!targetEl) return;
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const highlightTarget = targetEl.closest('p, div, li') || targetEl;
        const originalBg = highlightTarget.style.backgroundColor;
        const originalTransition = highlightTarget.style.transition;
        highlightTarget.style.transition = 'background-color 0.3s ease';
        highlightTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.28)';
        highlightTarget.style.borderRadius = '6px';
        setTimeout(() => {
            highlightTarget.style.backgroundColor = originalBg;
            highlightTarget.style.transition = originalTransition;
        }, 2200);
    }

    if (footnotePopover) {
        footnotePopover.addEventListener('mouseenter', () => clearTimeout(footnoteHideTimeout));
        footnotePopover.addEventListener('mouseleave', () => {
            footnoteHideTimeout = setTimeout(() => {
                footnotePopover.style.display = 'none';
            }, 250);
        });
    }

    function showSmartSourcePopover(sourceEl) {
        if (!footnotePopover || !sourceEl) return;
        const refQuery = sourceEl.dataset.refQuery || sourceEl.textContent.trim();
        if (!refQuery) return;
        clearTimeout(footnoteHideTimeout);

        const sefariaUrl = `https://www.sefaria.org.il/search?q=${encodeURIComponent(refQuery)}`;
        footnotePopover.innerHTML = `
            <div class="footnote-popover-header">
                <span>📖 מראה מקום: ${refQuery}</span>
                <button id="closeFootnotePopoverBtn" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>
            </div>
            <div class="footnote-popover-body" style="font-size: 0.9rem; color: var(--text-muted);">
                לחץ לעיון במקור המלא בספריא או לחיפוש כל המקומות שבהם הרב אשכנזי (מניטו) עוסק במקור זה בספרייה.
            </div>
            <div class="footnote-popover-footer" style="display:flex; gap:8px; flex-wrap:wrap; margin-top: 8px;">
                <a href="${sefariaUrl}" target="_blank" rel="noopener" class="footnote-popover-jump" style="text-decoration:none; padding: 4px 10px; border-radius: 10px; background: rgba(212,175,55,0.14); border: 1px solid rgba(212,175,55,0.35);">פתח בספריא (Sefaria) ↗</a>
                <button type="button" class="footnote-popover-jump" id="searchSourceInManitouBtn" style="padding: 4px 10px; border-radius: 10px; background: var(--secondary-bg); border: 1px solid var(--border);">🔍 חפש בכתבי מניטו</button>
            </div>
        `;
        footnotePopover.style.display = 'block';

        const rect = sourceEl.getBoundingClientRect();
        const popRect = footnotePopover.getBoundingClientRect();
        let top = rect.top - popRect.height - 10;
        if (top < 12) top = rect.bottom + 10;
        let left = rect.left + (rect.width / 2) - (popRect.width / 2);
        left = Math.max(16, Math.min(window.innerWidth - popRect.width - 16, left));

        footnotePopover.style.top = `${top}px`;
        footnotePopover.style.left = `${left}px`;

        const closeBtn = document.getElementById('closeFootnotePopoverBtn');
        if (closeBtn) closeBtn.onclick = () => { footnotePopover.style.display = 'none'; };

        const searchBtn = document.getElementById('searchSourceInManitouBtn');
        if (searchBtn) {
            searchBtn.onclick = () => {
                footnotePopover.style.display = 'none';
                const firstWord = refQuery.split(',')[0].trim();
                window.location.hash = '#/';
                setTimeout(() => {
                    const advSearchInput = document.getElementById('advSearchInput');
                    const advSearchBtn = document.getElementById('advSearchBtn');
                    const advSearchSection = document.getElementById('advancedSearchSection');
                    if (advSearchSection) advSearchSection.scrollIntoView({ behavior: 'smooth' });
                    if (advSearchInput && advSearchBtn) {
                        advSearchInput.value = firstWord;
                        advSearchBtn.click();
                    }
                }, 260);
            };
        }
    }

    if (textContent) {
        textContent.addEventListener('mouseover', (e) => {
            const sourceEl = e.target.closest('.smart-source-ref');
            if (sourceEl) {
                showSmartSourcePopover(sourceEl);
                return;
            }
            const link = e.target.closest('a');
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if ((href.startsWith('#_ftn') || href.startsWith('#fn')) && !href.includes('ref')) {
                const targetId = href.substring(1);
                const targetEl = findInternalAnchorTarget(targetId);
                if (targetEl) {
                    showFootnotePreview(link, targetEl, targetId);
                }
            }
        });

        textContent.addEventListener('mouseout', (e) => {
            const sourceEl = e.target.closest('.smart-source-ref');
            if (sourceEl) {
                footnoteHideTimeout = setTimeout(() => {
                    if (footnotePopover) footnotePopover.style.display = 'none';
                }, 300);
                return;
            }
            const link = e.target.closest('a');
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if (href.startsWith('#') && !href.startsWith('#/')) {
                footnoteHideTimeout = setTimeout(() => {
                    if (footnotePopover) footnotePopover.style.display = 'none';
                }, 280);
            }
        });

        textContent.addEventListener('click', (e) => {
            const sourceEl = e.target.closest('.smart-source-ref');
            if (sourceEl) {
                e.preventDefault();
                showSmartSourcePopover(sourceEl);
                return;
            }
            const link = e.target.closest('a');
            if (link) {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#') && !href.startsWith('#/')) {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    const targetEl = findInternalAnchorTarget(targetId);
                    if (targetEl) {
                        scrollToAndFlashElement(targetEl);
                    }
                }
            }
        });
    }

    // Sidebar toggle for mobile & desktop
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const desktopSidebarToggleBtn = document.getElementById('desktopSidebarToggleBtn');
    const desktopSidebarToggleText = document.getElementById('desktopSidebarToggleText');
    const chaptersSidebar = document.querySelector('.chapters-sidebar');
    const readerLayoutEl = document.querySelector('.reader-layout');

    if (toggleSidebarBtn && chaptersSidebar) {
        toggleSidebarBtn.addEventListener('click', () => {
            chaptersSidebar.classList.toggle('active');
        });
    }

    if (desktopSidebarToggleBtn && readerLayoutEl) {
        const sidebarDirectCollapseBtn = document.getElementById('sidebarDirectCollapseBtn');
        const sidebarExpandFloatingTab = document.getElementById('sidebarExpandFloatingTab');

        function setDesktopSidebarCollapsed(collapsed) {
            readerLayoutEl.classList.toggle('sidebar-collapsed', collapsed);
            localStorage.setItem('readerSidebarCollapsed', String(collapsed));
            if (desktopSidebarToggleText) {
                desktopSidebarToggleText.textContent = collapsed ? 'הצג פרקים' : 'הסתר פרקים';
            }
            desktopSidebarToggleBtn.classList.toggle('is-active', collapsed);
        }

        const savedSidebarCollapsed = localStorage.getItem('readerSidebarCollapsed') === 'true';
        if (savedSidebarCollapsed && window.innerWidth > 992) {
            setDesktopSidebarCollapsed(true);
        }
        desktopSidebarToggleBtn.addEventListener('click', () => {
            if (window.innerWidth <= 992 && chaptersSidebar) {
                chaptersSidebar.classList.toggle('active');
                return;
            }
            const nextState = !readerLayoutEl.classList.contains('sidebar-collapsed');
            setDesktopSidebarCollapsed(nextState);
        });
        if (sidebarDirectCollapseBtn) {
            sidebarDirectCollapseBtn.addEventListener('click', () => setDesktopSidebarCollapsed(true));
        }
        if (sidebarExpandFloatingTab) {
            sidebarExpandFloatingTab.addEventListener('click', () => setDesktopSidebarCollapsed(false));
        }
    }

    // Toggle Theme in Reader (Light -> Sepia -> Dark)
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            cycleTheme();
        });
    }

    // Direct Theme Selection from Dropdown buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.themeVal);
        });
    });

    // --- Zen Mode (Focused Fullscreen Reading) ---
    const zenModeBtn = document.getElementById('zenModeBtn');
    const readerContainer = document.getElementById('readerMode');
    
    if (zenModeBtn && readerContainer) {
        const zenIconEnter = zenModeBtn.querySelector('.zen-icon-enter');
        const zenIconExit = zenModeBtn.querySelector('.zen-icon-exit');
        const zenModeText = document.getElementById('zenModeText');
        
        function setZenMode(enable) {
            if (enable) {
                readerContainer.classList.add('zen-mode');
                if (zenIconEnter) zenIconEnter.style.display = 'none';
                if (zenIconExit) zenIconExit.style.display = 'inline-block';
                if (zenModeText) zenModeText.textContent = 'צא ממסך מלא';
                zenModeBtn.classList.add('btn-primary');
                zenModeBtn.classList.remove('btn-secondary');
            } else {
                readerContainer.classList.remove('zen-mode');
                if (zenIconEnter) zenIconEnter.style.display = 'inline-block';
                if (zenIconExit) zenIconExit.style.display = 'none';
                if (zenModeText) zenModeText.textContent = 'מסך מלא';
                zenModeBtn.classList.add('btn-secondary');
                zenModeBtn.classList.remove('btn-primary');
            }
        }
        
        zenModeBtn.addEventListener('click', async () => {
            const isZen = readerContainer.classList.contains('zen-mode');
            if (!isZen) {
                setZenMode(true);
                try {
                    if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                    }
                } catch (e) {}
            } else {
                setZenMode(false);
                try {
                    if (document.fullscreenElement && document.exitFullscreen) {
                        await document.exitFullscreen();
                    }
                } catch (e) {}
            }
        });
        
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && readerContainer.classList.contains('zen-mode')) {
                setZenMode(false);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && readerContainer.classList.contains('zen-mode')) {
                setZenMode(false);
            }
        });
    }

    // --- In-Chapter Search Logic (Ctrl+F) ---
    const toggleChapterSearchBtn = document.getElementById('toggleChapterSearchBtn');
    const inChapterSearchBar = document.getElementById('inChapterSearchBar');
    const inChapterSearchInput = document.getElementById('inChapterSearchInput');
    const inChapterCount = document.getElementById('inChapterCount');
    const inChapterPrevBtn = document.getElementById('inChapterPrevBtn');
    const inChapterNextBtn = document.getElementById('inChapterNextBtn');
    const inChapterGlobalSearchBtn = document.getElementById('inChapterGlobalSearchBtn');
    const closeInChapterSearchBtn = document.getElementById('closeInChapterSearchBtn');
    
    let chapterMatches = [];
    let currentMatchIndex = -1;
    
    function clearChapterSearch() {
        if (!textContent) return;
        const matches = textContent.querySelectorAll('.chapter-search-match');
        matches.forEach(m => {
            const parent = m.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(m.textContent), m);
                parent.normalize();
            }
        });
        chapterMatches = [];
        currentMatchIndex = -1;
        if (inChapterCount) inChapterCount.textContent = '0/0';
    }
    
    function performInChapterSearch() {
        clearChapterSearch();
        const query = inChapterSearchInput ? inChapterSearchInput.value.trim() : '';
        if (!query || !textContent) return;
        
        let regex;
        try {
            regex = makeHebrewNikkudRegex(query, false);
        } catch (e) {
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(`(${escaped})`, 'gi');
        }
        const strippedQuery = stripNikkud(query.toLowerCase());
        
        const textNodes = [];
        const walk = document.createTreeWalker(textContent, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walk.nextNode()) {
            const parent = node.parentNode;
            if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.classList.contains('glossary-tooltip') || parent.classList.contains('para-anchor-btn'))) continue;
            textNodes.push(node);
        }
        
        textNodes.forEach(tNode => {
            const text = tNode.textContent;
            if (!regex.test(text)) return;
            regex.lastIndex = 0;
            
            const parts = text.split(regex);
            const fragment = document.createDocumentFragment();
            parts.forEach(part => {
                if (part && stripNikkud(part.toLowerCase()) === strippedQuery) {
                    const mark = document.createElement('mark');
                    mark.className = 'chapter-search-match';
                    mark.textContent = part;
                    fragment.appendChild(mark);
                    chapterMatches.push(mark);
                } else if (part) {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            if (tNode.parentNode) {
                tNode.parentNode.replaceChild(fragment, tNode);
            }
        });
        
        if (chapterMatches.length > 0) {
            goToMatch(0);
        } else {
            if (inChapterCount) inChapterCount.textContent = '0/0';
        }
    }
    
    function goToMatch(index) {
        if (chapterMatches.length === 0) return;
        if (currentMatchIndex >= 0 && chapterMatches[currentMatchIndex]) {
            chapterMatches[currentMatchIndex].classList.remove('chapter-search-match-active');
        }
        currentMatchIndex = (index + chapterMatches.length) % chapterMatches.length;
        const activeMatch = chapterMatches[currentMatchIndex];
        activeMatch.classList.add('chapter-search-match-active');
        activeMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (inChapterCount) inChapterCount.textContent = `${currentMatchIndex + 1}/${chapterMatches.length}`;
    }
    
    if (toggleChapterSearchBtn && inChapterSearchBar) {
        toggleChapterSearchBtn.addEventListener('click', () => {
            const isHidden = inChapterSearchBar.style.display === 'none' || inChapterSearchBar.style.display === '';
            if (isHidden) {
                inChapterSearchBar.style.display = 'flex';
                setTimeout(() => inChapterSearchInput && inChapterSearchInput.focus(), 60);
            } else {
                inChapterSearchBar.style.display = 'none';
                clearChapterSearch();
            }
        });
        
        if (closeInChapterSearchBtn) {
            closeInChapterSearchBtn.addEventListener('click', () => {
                inChapterSearchBar.style.display = 'none';
                clearChapterSearch();
            });
        }
        
        if (inChapterSearchInput) {
            inChapterSearchInput.addEventListener('input', () => {
                performInChapterSearch();
            });
            inChapterSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        goToMatch(currentMatchIndex - 1);
                    } else {
                        goToMatch(currentMatchIndex + 1);
                    }
                } else if (e.key === 'Escape') {
                    inChapterSearchBar.style.display = 'none';
                    clearChapterSearch();
                }
            });
        }
        
        if (inChapterNextBtn) inChapterNextBtn.addEventListener('click', () => goToMatch(currentMatchIndex + 1));
        if (inChapterPrevBtn) inChapterPrevBtn.addEventListener('click', () => goToMatch(currentMatchIndex - 1));
        if (inChapterGlobalSearchBtn) {
            inChapterGlobalSearchBtn.addEventListener('click', () => {
                const q = inChapterSearchInput ? inChapterSearchInput.value.trim() : '';
                if (typeof window.openQuickSearch === 'function') {
                    window.openQuickSearch(q);
                }
            });
        }
    }
    
    // Global Ctrl+F / Cmd+F handler inside reader
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            const readerMode = document.getElementById('readerMode');
            if (readerMode && readerMode.style.display !== 'none' && inChapterSearchBar) {
                e.preventDefault();
                inChapterSearchBar.style.display = 'flex';
                setTimeout(() => inChapterSearchInput && inChapterSearchInput.select(), 50);
            }
        }
    });

    // --- Text Settings Logic ---
    const toggleTextSettingsBtn = document.getElementById('toggleTextSettingsBtn');
    const textSettingsDropdown = document.getElementById('textSettingsDropdown');
    const decreaseFontBtn = document.getElementById('decreaseFontBtn');
    const increaseFontBtn = document.getElementById('increaseFontBtn');
    const fontSizeDisplay = document.getElementById('fontSizeDisplay');
    const fontBtns = document.querySelectorAll('.font-btn');
    const lhBtns = document.querySelectorAll('.lh-btn');
    const widthBtns = document.querySelectorAll('.width-btn');

    let currentFontSize = parseFloat(localStorage.getItem('readerFontSize')) || 1.22;
    let currentFontFamily = localStorage.getItem('readerFontFamily') || 'serif';
    let currentLineHeight = localStorage.getItem('readerLineHeight') || '1.92';
    let currentPageWidth = localStorage.getItem('readerPageWidth') || 'normal';

    const FONT_FAMILY_MAP = {
        serif: "'Frank Ruhl Libre', serif",
        david: "'David Libre', serif",
        sans: "'Heebo', sans-serif",
        rubik: "'Rubik', sans-serif"
    };
    
    function applyTextSettings() {
        if(textContent) {
            textContent.style.fontSize = currentFontSize + 'rem';
            textContent.style.fontFamily = FONT_FAMILY_MAP[currentFontFamily] || FONT_FAMILY_MAP.serif;
            textContent.style.lineHeight = currentLineHeight;
            textContent.style.maxWidth = currentPageWidth === 'wide' ? '1120px' : '820px';
            
            // Update display
            const percent = Math.round((currentFontSize / 1.22) * 100);
            if(fontSizeDisplay) fontSizeDisplay.textContent = percent + '%';
            
            // Update font buttons
            fontBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.font === currentFontFamily);
            });

            // Update line-height buttons
            lhBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lh === String(currentLineHeight));
            });

            widthBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.width === currentPageWidth);
            });
            
            localStorage.setItem('readerFontSize', currentFontSize);
            localStorage.setItem('readerFontFamily', currentFontFamily);
            localStorage.setItem('readerLineHeight', currentLineHeight);
            localStorage.setItem('readerPageWidth', currentPageWidth);
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

        lhBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentLineHeight = btn.dataset.lh;
                applyTextSettings();
            });
        });

        widthBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentPageWidth = btn.dataset.width;
                applyTextSettings();
            });
        });
        
        // Initial application
        applyTextSettings();
    }

    const seriesFilterSelect = document.getElementById('seriesFilterSelect');
    const viewModeShelvesBtn = document.getElementById('viewModeShelvesBtn');
    const viewModeGridBtn = document.getElementById('viewModeGridBtn');

    if (viewModeShelvesBtn && viewModeGridBtn) {
        viewModeShelvesBtn.addEventListener('click', () => {
            libraryViewMode = 'shelves';
            localStorage.setItem('manitou_library_view_mode', 'shelves');
            const { activeTab, searchTerm, seriesVal } = getCurrentLibraryFilters();
            filterBooks(activeTab, searchTerm, seriesVal);
        });
        viewModeGridBtn.addEventListener('click', () => {
            libraryViewMode = 'grid';
            localStorage.setItem('manitou_library_view_mode', 'grid');
            const { activeTab, searchTerm, seriesVal } = getCurrentLibraryFilters();
            filterBooks(activeTab, searchTerm, seriesVal);
        });
    }

    function getCurrentLibraryFilters() {
        const activeTabEl = document.querySelector('.filter-tabs .tab.active');
        const activeTab = activeTabEl ? activeTabEl.dataset.filter : 'all';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const seriesVal = seriesFilterSelect ? seriesFilterSelect.value : 'all';
        return { activeTab, searchTerm, seriesVal };
    }

    // Filtering
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const { activeTab, searchTerm, seriesVal } = getCurrentLibraryFilters();
            filterBooks(activeTab, searchTerm, seriesVal);
        });
    });

    if (seriesFilterSelect) {
        seriesFilterSelect.addEventListener('change', () => {
            const { activeTab, searchTerm, seriesVal } = getCurrentLibraryFilters();
            filterBooks(activeTab, searchTerm, seriesVal);
        });
    }

    // --- Unified Top Search Engine (Books / Transcripts / Both — Live & Full-Text) ---
    const advSearchSection = document.getElementById('advancedSearchSection');
    const advSearchInput = document.getElementById('advSearchInput');
    const advSearchBtn = document.getElementById('advSearchBtn');
    const clearAdvSearchBtn = document.getElementById('clearAdvSearchBtn');
    const toggleAdvFiltersBtn = document.getElementById('toggleAdvFiltersBtn');
    const advFiltersDrawer = document.getElementById('advFiltersDrawer');
    const advSearchResults = document.getElementById('advSearchResults');
    const advSearchCategory = document.getElementById('advSearchCategory');
    const advSearchBook = document.getElementById('advSearchBook');
    const advSearchToolbarButtons = document.querySelectorAll('#advSearchToolbar .toolbar-btn');
    const advScopeBtns = document.querySelectorAll('#advSearchScopePills .scope-pill-btn');

    let currentSearchMode = 'and'; // 'and', 'or', 'exact', 'exact_word'
    let currentAdvSearchScope = 'both'; // 'both', 'books', 'transcripts'
    let unifiedSearchDebounce = null;
    let unifiedSearchSeq = 0;

    // Warm up search indexes quietly in background so live search responds in milliseconds
    setTimeout(() => {
        ensureTranscriptsArchiveLoaded().catch(() => {});
        ensureAllBooksLoaded().catch(() => {});
    }, 450);

    function setAdvSearchScopeUI(scope) {
        currentAdvSearchScope = scope || 'both';
        advScopeBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.scope === currentAdvSearchScope);
        });
        if (advSearchInput) {
            if (currentAdvSearchScope === 'books') {
                advSearchInput.placeholder = 'חפש מילה, משפט או נושא בכל 24 ספרי מניטו...';
            } else if (currentAdvSearchScope === 'transcripts') {
                advSearchInput.placeholder = 'חפש מילה, משפט או נושא בכל אלפי תמלולי השיעורים והמאמרים...';
            } else {
                advSearchInput.placeholder = 'חפש מילה, ביטוי או נושא בכל הספרים והתמלולים...';
            }
        }
        if (advSearchBook) {
            const isTrOnly = currentAdvSearchScope === 'transcripts';
            advSearchBook.disabled = isTrOnly;
            advSearchBook.style.opacity = isTrOnly ? '0.45' : '1';
        }
    }

    function clearAndCloseUnifiedSearch() {
        clearTimeout(unifiedSearchDebounce);
        unifiedSearchSeq++;
        if (advSearchInput) advSearchInput.value = '';
        if (clearAdvSearchBtn) clearAdvSearchBtn.style.display = 'none';
        if (advSearchResults) {
            advSearchResults.style.display = 'none';
            advSearchResults.innerHTML = '';
            advSearchResults.classList.remove('is-expanded');
        }
    }

    if (clearAdvSearchBtn) {
        clearAdvSearchBtn.addEventListener('click', () => {
            clearAndCloseUnifiedSearch();
            if (advSearchInput) advSearchInput.focus();
        });
    }

    if (toggleAdvFiltersBtn && advFiltersDrawer) {
        toggleAdvFiltersBtn.addEventListener('click', () => {
            const isOpen = advFiltersDrawer.style.display === 'flex';
            advFiltersDrawer.style.display = isOpen ? 'none' : 'flex';
            toggleAdvFiltersBtn.setAttribute('aria-expanded', String(!isOpen));
            toggleAdvFiltersBtn.classList.toggle('active', !isOpen);
        });
    }

    advScopeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setAdvSearchScopeUI(btn.dataset.scope || 'both');
            if (advSearchInput && advSearchInput.value.trim()) {
                executeUnifiedSearch();
            }
        });
    });

    window.triggerAdvancedSearchWithScope = function(queryText, scope = 'both') {
        setAdvSearchScopeUI(scope);
        if (advSearchSection) {
            advSearchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (advSearchInput) {
            advSearchInput.value = queryText || '';
            if (clearAdvSearchBtn) clearAdvSearchBtn.style.display = queryText ? 'inline-flex' : 'none';
        }
        if (queryText) {
            executeUnifiedSearch();
        }
    };

    function populateAdvSearchBooks(selectedCategory = 'all') {
        if (!advSearchBook) return;
        const currentVal = advSearchBook.value;
        advSearchBook.innerHTML = '<option value="all">כל הספרים במאגר</option>';

        const filtered = (selectedCategory === 'all')
            ? books
            : books.filter(b => b.category === selectedCategory);

        filtered.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.title;
            advSearchBook.appendChild(opt);
        });

        if (Array.from(advSearchBook.options).some(o => o.value === currentVal)) {
            advSearchBook.value = currentVal;
        } else {
            advSearchBook.value = 'all';
        }
    }

    if (advSearchCategory) {
        advSearchCategory.addEventListener('change', () => {
            populateAdvSearchBooks(advSearchCategory.value);
            if (advSearchInput && advSearchInput.value.trim()) executeUnifiedSearch();
        });
    }
    if (advSearchBook) {
        advSearchBook.addEventListener('change', () => {
            if (advSearchInput && advSearchInput.value.trim()) executeUnifiedSearch();
        });
    }
    populateAdvSearchBooks();

    if (advSearchToolbarButtons) {
        advSearchToolbarButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                advSearchToolbarButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentSearchMode = btn.dataset.mode || 'and';
                if (advSearchInput && advSearchInput.value.trim()) {
                    executeUnifiedSearch();
                }
            });
        });
    }

    async function executeUnifiedSearch() {
        if (!advSearchInput || !advSearchResults) return;
        const rawInputVal = advSearchInput.value.trim();
        let rawQuery = rawInputVal.toLowerCase();
        if (!rawQuery) {
            advSearchResults.style.display = 'none';
            advSearchResults.innerHTML = '';
            return;
        }

        const mySeq = ++unifiedSearchSeq;
        const categoryFilter = advSearchCategory ? advSearchCategory.value : 'all';
        const bookFilter = advSearchBook ? advSearchBook.value : 'all';

        advSearchResults.style.display = 'block';
        if (!allBooksPreloaded || !transcriptsArchiveLoaded) {
            advSearchResults.innerHTML = `<div class="top-results-loading"><div class="search-loader-spinner"></div><span>סורק את מאגר הספרים והתמלולים...</span></div>`;
        }

        const isManualExact = rawQuery.startsWith('"') && rawQuery.endsWith('"') && rawQuery.length > 2;
        const searchMode = isManualExact ? 'exact' : currentSearchMode;

        let searchWords = [];
        if (searchMode === 'exact' || searchMode === 'exact_word') {
            searchWords = isManualExact ? [rawQuery.slice(1, -1).trim()] : [rawQuery];
        } else {
            searchWords = rawQuery.split(/\s+/).filter(w => w.length > 0);
        }

        if (searchWords.length === 0) {
            advSearchResults.style.display = 'none';
            return;
        }

        const loadTasks = [];
        if (currentAdvSearchScope !== 'transcripts') loadTasks.push(ensureAllBooksLoaded());
        if (currentAdvSearchScope !== 'books') loadTasks.push(ensureTranscriptsArchiveLoaded());
        await Promise.all(loadTasks);

        if (mySeq !== unifiedSearchSeq) return;

        const cleanSearchWords = searchWords.map(w => stripNikkud(w.toLowerCase()));
        let allResults = [];

        // Direct Book Title / Series Matches (for quick book opening)
        let matchedWholeBooks = [];
        if (currentAdvSearchScope !== 'transcripts') {
            const qStripped = cleanSearchWords.join(' ');
            matchedWholeBooks = books.filter(b => {
                if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
                if (bookFilter !== 'all' && String(b.id) !== String(bookFilter)) return false;
                const hay = stripNikkud(`${b.title || ''} ${b.series || ''} ${b.description || ''}`.toLowerCase());
                return cleanSearchWords.every(w => hay.includes(w)) || hay.includes(qStripped);
            }).slice(0, 6);
        }

        function evaluateTextDocument(plainText, lowerText, lowerTitle = '') {
            const combinedSearchable = lowerTitle ? `${lowerTitle}\n${lowerText}` : lowerText;
            let isMatch = false;
            if (searchMode === 'exact') {
                isMatch = combinedSearchable.includes(cleanSearchWords[0]);
            } else if (searchMode === 'exact_word') {
                const escapedWord = cleanSearchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])[בהוכלמש]{0,2}${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'i');
                isMatch = regex.test(combinedSearchable);
            } else if (searchMode === 'and') {
                isMatch = cleanSearchWords.every(word => combinedSearchable.includes(word));
            } else if (searchMode === 'or') {
                isMatch = cleanSearchWords.some(word => combinedSearchable.includes(word));
            }
            if (!isMatch) return null;

            let matchScore = 0;
            cleanSearchWords.forEach(word => {
                const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regexPattern = searchMode === 'exact_word'
                    ? `(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])[בהוכלמש]{0,2}${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`
                    : escapedWord;
                const occurrences = (lowerText.match(new RegExp(regexPattern, 'gi')) || []).length;
                const titleHits = lowerTitle ? (lowerTitle.match(new RegExp(regexPattern, 'gi')) || []).length : 0;
                matchScore += occurrences + (titleHits * 6);
            });

            const snippets = [];
            let index = -1;
            let firstFoundWord = '';
            if (searchMode === 'exact_word') {
                const escapedWord = cleanSearchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])[בהוכלמש]{0,2}${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'i');
                const match = regex.exec(lowerText);
                if (match) index = match.index;
            } else {
                firstFoundWord = cleanSearchWords.find(word => lowerText.includes(word)) || '';
                if (firstFoundWord) index = lowerText.indexOf(firstFoundWord);
            }

            if (index === -1 && plainText) {
                let snippet = plainText.substring(0, 190);
                if (plainText.length > 190) snippet += '...';
                snippets.push(snippet);
            } else {
                let occurrences = 0;
                const maxSnippets = (searchMode === 'exact' || searchMode === 'exact_word') ? 2 : 1;
                while (index !== -1 && occurrences < maxSnippets) {
                    const origIndex = getOriginalIndex(plainText, index);
                    const start = Math.max(0, origIndex - 70);
                    const end = Math.min(plainText.length, origIndex + 165);
                    let snippet = plainText.substring(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < plainText.length) snippet = snippet + '...';

                    searchWords.forEach(word => {
                        try {
                            const regex = makeHebrewNikkudRegex(word, searchMode === 'exact_word');
                            snippet = snippet.replace(regex, '%%MARK%%$1%%ENDMARK%%');
                        } catch (e) {}
                    });
                    snippet = snippet.replace(/%%MARK%%/g, '<mark class="top-res-mark">');
                    snippet = snippet.replace(/%%ENDMARK%%/g, '</mark>');
                    snippets.push(snippet);

                    if (searchMode === 'exact_word') {
                        const escapedWord = cleanSearchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])[בהוכלמש]{0,2}${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'gi');
                        regex.lastIndex = index + cleanSearchWords[0].length + 2;
                        const nextMatch = regex.exec(lowerText);
                        index = nextMatch ? nextMatch.index : -1;
                    } else if (firstFoundWord) {
                        index = lowerText.indexOf(firstFoundWord, index + firstFoundWord.length);
                    } else {
                        index = -1;
                    }
                    occurrences++;
                }
            }

            return { score: Math.max(1, matchScore), snippets };
        }

        let bookResultsCount = 0;
        if (currentAdvSearchScope !== 'transcripts') {
            for (const b of books) {
                if (categoryFilter !== 'all' && b.category !== categoryFilter) continue;
                if (bookFilter !== 'all' && String(b.id) !== String(bookFilter)) continue;
                const chapters = chapterCache[b.id];
                if (!chapters) continue;

                chapters.forEach(chap => {
                    if (!chap.text) return;
                    const plainText = chap._plainText || '';
                    const lowerText = chap._lowerText || '';
                    if (!plainText) return;
                    const lowerTitle = stripNikkud((chap.title || '').toLowerCase());
                    const evaluated = evaluateTextDocument(plainText, lowerText, lowerTitle);
                    if (!evaluated) return;

                    evaluated.snippets.forEach(snippet => {
                        bookResultsCount++;
                        allResults.push({
                            resultType: 'book',
                            book: b,
                            chapter: chap,
                            snippet,
                            score: evaluated.score
                        });
                    });
                });
            }
        }

        let transcriptResultsCount = 0;
        if (currentAdvSearchScope !== 'books') {
            for (const tr of transcriptsArchiveItems) {
                if (categoryFilter !== 'all' && categoryFilter !== 'lessons') {
                    const catAndTitle = `${tr._lowerCategory || ''} ${tr._lowerTitle || ''}`;
                    if (categoryFilter === 'history' && !/(תולדות|בראשית|שמות|ויקרא|במדבר|דברים|נביאים|מגיל|היסטור|זהות)/.test(catAndTitle)) continue;
                    if (categoryFilter === 'philosophy' && !/(מחשבה|קבלה|אמונה|פילוסופ|מוסר|תפילה|הקדמ|שיעור|מאמר)/.test(catAndTitle)) continue;
                }
                const plainText = tr.plainText || '';
                const lowerText = tr._lowerText || '';
                if (!plainText && !tr._lowerTitle) continue;
                const evaluated = evaluateTextDocument(plainText, lowerText, tr._lowerTitle || '');
                if (!evaluated) continue;

                evaluated.snippets.forEach(snippet => {
                    transcriptResultsCount++;
                    allResults.push({
                        resultType: 'transcript',
                        transcript: tr,
                        snippet,
                        score: evaluated.score
                    });
                });
            }
        }

        allResults.sort((a, b) => b.score - a.score);

        if (allResults.length === 0 && matchedWholeBooks.length === 0) {
            advSearchResults.innerHTML = `
                <div class="top-results-header">
                    <span class="top-results-count">לא נמצאו תוצאות עבור <strong>"${rawInputVal}"</strong></span>
                    <button type="button" class="top-results-close-btn" id="closeUnifiedResultsBtn">✕ סגור</button>
                </div>
                <div class="top-results-empty">
                    נסה להחליף בין <strong>הכל / ספרים / תמלולים</strong> או לשנות את מצב ההתאמה ל-<strong>לפחות מילה</strong>.
                </div>
            `;
            const closeBtn = document.getElementById('closeUnifiedResultsBtn');
            if (closeBtn) closeBtn.addEventListener('click', clearAndCloseUnifiedSearch);
            return;
        }

        const safeQueryAttr = rawQuery.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const breakdownBadges = [];
        if (currentAdvSearchScope !== 'transcripts') breakdownBadges.push(`<span class="res-stat-pill book-stat">📚 ${bookResultsCount} בפרקי הספרים</span>`);
        if (currentAdvSearchScope !== 'books') breakdownBadges.push(`<span class="res-stat-pill tr-stat">🎙️ ${transcriptResultsCount} בתמלולים</span>`);

        const matchedBooksStripHtml = matchedWholeBooks.length > 0 ? `
            <div class="top-matched-books-strip">
                <span class="matched-books-label">ספרים תואמים:</span>
                ${matchedWholeBooks.map(b => `<a href="#/reader/${b.id}" class="matched-book-chip">📚 ${b.title}</a>`).join('')}
            </div>
        ` : '';

        const itemsHtml = allResults.slice(0, 180).map(res => {
            if (res.resultType === 'transcript') {
                const tr = res.transcript;
                const safeTrId = String(tr.id).replace(/'/g, "\\'");
                return `
                    <div class="top-result-card is-transcript" onclick="window.jumpToTranscriptRecord('${safeTrId}', '${safeQueryAttr}')">
                        <div class="top-result-card-head">
                            <div class="top-result-title-group">
                                <span class="top-result-badge tr-badge">תמלול</span>
                                <span class="top-result-title">${tr.title}</span>
                            </div>
                            <span class="top-result-meta">${tr.category || tr.sourceSite || 'ארכיון השיעורים'}</span>
                        </div>
                        <p class="top-result-snippet">${res.snippet}</p>
                    </div>
                `;
            }
            const cleanChapTitle = formatChapterDisplayTitle(res.chapter.title, res.book);
            return `
                <div class="top-result-card is-book" onclick="openBookToChapter(${res.book.id}, ${res.chapter.id}, '${safeQueryAttr}', '${searchMode}')">
                    <div class="top-result-card-head">
                        <div class="top-result-title-group">
                            <span class="top-result-badge book-badge">ספר</span>
                            <span class="top-result-title">${res.book.title}</span>
                            <span class="top-result-chap">— ${cleanChapTitle}</span>
                        </div>
                        <span class="top-result-meta">${res.score > 1 ? `${res.score} מופעים` : 'מופע אחד'}</span>
                    </div>
                    <p class="top-result-snippet">${res.snippet}</p>
                </div>
            `;
        }).join('');

        advSearchResults.innerHTML = `
            <div class="top-results-header">
                <div class="top-results-stats">
                    <span class="top-results-count">נמצאו <strong>${allResults.length}</strong> תוצאות</span>
                    ${breakdownBadges.join('')}
                </div>
                <div class="top-results-actions">
                    <button type="button" class="top-results-expand-btn" id="expandUnifiedResultsBtn">${advSearchResults.classList.contains('is-expanded') ? 'כווץ חלון' : 'הרחב חלון'}</button>
                    <button type="button" class="top-results-close-btn" id="closeUnifiedResultsBtn">✕ סגור</button>
                </div>
            </div>
            ${matchedBooksStripHtml}
            <div class="top-results-list">${itemsHtml}</div>
        `;

        const closeBtn = document.getElementById('closeUnifiedResultsBtn');
        if (closeBtn) closeBtn.addEventListener('click', clearAndCloseUnifiedSearch);

        const expandBtn = document.getElementById('expandUnifiedResultsBtn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const expanded = advSearchResults.classList.toggle('is-expanded');
                expandBtn.textContent = expanded ? 'כווץ חלון' : 'הרחב חלון';
            });
        }
    }

    if (advSearchInput) {
        advSearchInput.addEventListener('input', () => {
            const val = advSearchInput.value;
            if (clearAdvSearchBtn) clearAdvSearchBtn.style.display = val.trim() ? 'inline-flex' : 'none';
            clearTimeout(unifiedSearchDebounce);
            if (!val.trim()) {
                advSearchResults.style.display = 'none';
                advSearchResults.innerHTML = '';
                return;
            }
            if (val.trim().length >= 2) {
                unifiedSearchDebounce = setTimeout(() => {
                    executeUnifiedSearch();
                }, 260);
            }
        });

        advSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(unifiedSearchDebounce);
                executeUnifiedSearch();
            } else if (e.key === 'Escape') {
                clearAndCloseUnifiedSearch();
                advSearchInput.blur();
            }
        });
    }

    if (advSearchBtn) {
        advSearchBtn.addEventListener('click', () => {
            clearTimeout(unifiedSearchDebounce);
            executeUnifiedSearch();
        });
    }

    function filterBooks(filter, searchTerm, seriesFilter = null) {
        const effectiveSeries = seriesFilter !== null ? seriesFilter : (seriesFilterSelect ? seriesFilterSelect.value : 'all');
        let filteredBooks = books;

        if (filter && filter !== 'all') {
            filteredBooks = filteredBooks.filter(book => book.category === filter);
        }

        if (effectiveSeries && effectiveSeries !== 'all') {
            filteredBooks = filteredBooks.filter(book => book.series === effectiveSeries);
        }

        if (searchTerm) {
            filteredBooks = filteredBooks.filter(book => 
                book.title.toLowerCase().includes(searchTerm) || 
                (book.description && book.description.toLowerCase().includes(searchTerm)) ||
                (book.series && book.series.toLowerCase().includes(searchTerm))
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

    // Initial render (catalog.json already includes chaptersCount, totalWords, totalReadingMinutes)
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
            
            deepSearchResults.innerHTML = '<div style="text-align:center; padding: 3rem 0; display: flex; flex-direction: column; align-items: center; gap: 15px;"><div class="search-loader-spinner"></div><p style="color: var(--text-muted); font-size: 1.1rem; font-family: var(--font-sans);">סורק ומחפש במאות פרקי הארכיון...</p></div>';
            
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
                            
                            const lowerText = stripNikkud(plainText.toLowerCase());
                            const cleanSearchWords = searchWords.map(w => stripNikkud(w.toLowerCase()));
                            
                            // Check if ALL search words exist in this chapter
                            const allExist = cleanSearchWords.every(word => lowerText.includes(word));
                            if (!allExist) return;
                            
                            // For exact match, we can find multiple occurrences.
                            // For AND search, we'll just find the first occurrence of the FIRST word to center the snippet.
                            let index = lowerText.indexOf(cleanSearchWords[0]);
                            let occurrences = 0;
                            
                            while (index !== -1 && occurrences < (isExactMatch ? 3 : 1)) {
                                const origIndex = getOriginalIndex(plainText, index);
                                const start = Math.max(0, origIndex - 80);
                                const end = Math.min(plainText.length, origIndex + 200); // give a bit more room for AND searches
                                
                                let snippet = plainText.substring(start, end);
                                if (start > 0) snippet = '...' + snippet;
                                if (end < plainText.length) snippet = snippet + '...';
                                
                                // Highlight all search words
                                searchWords.forEach(word => {
                                    try {
                                        const regex = makeHebrewNikkudRegex(word, false);
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
                                
                                index = lowerText.indexOf(cleanSearchWords[0], index + cleanSearchWords[0].length);
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
                    openBookToChapter(res.book.id, res.chapter.id, rawQuery, isExactMatch ? 'exact' : 'and');
                });
            });
        });
    }

    
    // Theme Management (Light / Day, Sepia / Parchment, Dark / Night)
    const SUN_SVG_INNER = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    const MOON_SVG_INNER = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

    const THEME_DESCRIPTIONS = {
        light: 'מצב יום: רקע בהיר ונקי לקריאה נוחה באור יום',
        sepia: 'מצב קלף (ספיה): גוון נייר ספר עתיק וחם להפחתת סינוור ומאמץ בעיניים בקריאה ממושכת',
        dark: 'מצב לילה: רקע כהה וניגודיות רכה לקריאה נעימה בחושך'
    };

    function setTheme(theme) {
        const readerContainerEl = document.getElementById('readerMode');
        if (theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            if (readerContainerEl) readerContainerEl.classList.remove('light-theme');
            localStorage.setItem('theme', 'dark');
        } else if (theme === 'sepia') {
            document.body.setAttribute('data-theme', 'sepia');
            if (readerContainerEl) readerContainerEl.classList.remove('light-theme');
            localStorage.setItem('theme', 'sepia');
        } else {
            document.body.removeAttribute('data-theme');
            if (readerContainerEl) readerContainerEl.classList.remove('light-theme');
            localStorage.setItem('theme', 'light');
        }
        updateThemeUI();
    }

    // Main top-bar button toggles cleanly between Day (light) and Night (dark)
    function cycleTheme() {
        const current = localStorage.getItem('theme') || 'light';
        if (current === 'dark') {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    }

    function updateThemeUI() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        
        // Update active class on Aa settings dropdown buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeVal === currentTheme);
        });

        // Update description text in Aa settings dropdown
        const descEl = document.getElementById('themeModeDescText');
        if (descEl) {
            descEl.textContent = THEME_DESCRIPTIONS[currentTheme] || THEME_DESCRIPTIONS.light;
        }
        
        // Update button text and SVG icons (Sun icon for "מצב יום", Moon icon for "מצב לילה")
        const readerThemeText = document.getElementById('readerThemeText');
        const navThemeText = document.getElementById('navThemeText');
        const drawerThemeText = document.getElementById('drawerThemeText');
        const readerThemeIcon = document.getElementById('readerThemeIcon');
        const navThemeIcon = document.getElementById('navThemeIcon') || document.querySelector('#navThemeToggle svg');
        const drawerThemeIcon = document.getElementById('drawerThemeIcon') || document.querySelector('#drawerThemeToggle svg');
        
        const showDayAction = (currentTheme === 'dark');
        const label = showDayAction ? 'מצב יום' : 'מצב לילה';
        const svgInner = showDayAction ? SUN_SVG_INNER : MOON_SVG_INNER;
        const iconColor = showDayAction ? '#fbbf24' : 'currentColor';
        
        if (readerThemeText) readerThemeText.textContent = label;
        if (navThemeText) navThemeText.textContent = label;
        if (drawerThemeText) drawerThemeText.textContent = label;

        [readerThemeIcon, navThemeIcon, drawerThemeIcon].forEach(iconEl => {
            if (iconEl) {
                iconEl.innerHTML = svgInner;
                iconEl.style.color = iconColor;
            }
        });
    }
    
    // Check for saved theme on load
    const initialSavedTheme = localStorage.getItem('theme');
    if (initialSavedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    } else if (initialSavedTheme === 'sepia') {
        document.body.setAttribute('data-theme', 'sepia');
    }
    updateThemeUI();
    
    // Nav Theme Toggle
    const navThemeToggle = document.getElementById('navThemeToggle');
    if (navThemeToggle) {
        navThemeToggle.addEventListener('click', () => {
            cycleTheme();
        });
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
    // --- Audio Player Engine (Authentic Recording + TTS Sync) ---
    const playAudioBtn = document.getElementById('playAudioBtn');
    const playAudioBtnText = document.getElementById('playAudioBtnText');
    const readerAudioPlayerBar = document.getElementById('readerAudioPlayerBar');
    const audioModeBadge = document.getElementById('audioModeBadge');
    const audioBookLabel = document.getElementById('audioBookLabel');
    const audioChapterLabel = document.getElementById('audioChapterLabel');
    const audioModeReal = document.getElementById('audioModeReal');
    const audioModeTTS = document.getElementById('audioModeTTS');
    const audioSkipBackBtn = document.getElementById('audioSkipBackBtn');
    const audioSkipFwdBtn = document.getElementById('audioSkipFwdBtn');
    const audioPlayMainBtn = document.getElementById('audioPlayMainBtn');
    const audioPlayMainIcon = document.getElementById('audioPlayMainIcon');
    const audioPauseMainIcon = document.getElementById('audioPauseMainIcon');
    const audioSpeedBtn = document.getElementById('audioSpeedBtn');
    const audioCurrentTime = document.getElementById('audioCurrentTime');
    const audioTotalDuration = document.getElementById('audioTotalDuration');
    const audioProgressTrack = document.getElementById('audioProgressTrack');
    const audioProgressFill = document.getElementById('audioProgressFill');
    const audioMuteBtn = document.getElementById('audioMuteBtn');
    const audioVolHighIcon = document.getElementById('audioVolHighIcon');
    const audioVolMuteIcon = document.getElementById('audioVolMuteIcon');
    const audioVolumeSlider = document.getElementById('audioVolumeSlider');
    const audioCloseBtn = document.getElementById('audioCloseBtn');
    const realAudioElement = document.getElementById('realAudioElement');

    let currentAudioMode = 'real'; // 'real' or 'tts'
    let synth = window.speechSynthesis;
    let isTtsPlaying = false;
    let utterance = null;
    let ttsParagraphs = [];
    let currentTtsParaIndex = 0;
    const speedRates = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
    let currentSpeedIndex = 0;

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateAudioMetadata() {
        if (audioBookLabel) audioBookLabel.textContent = document.getElementById('readerBookTitle')?.textContent || 'שיעורי מניטו';
        if (audioChapterLabel) audioChapterLabel.textContent = document.getElementById('readerChapterTitle')?.textContent || '';
    }

    function setAudioPlayingState(isPlaying) {
        if (isPlaying) {
            if (audioPlayMainIcon) audioPlayMainIcon.style.display = 'none';
            if (audioPauseMainIcon) audioPauseMainIcon.style.display = 'block';
            if (playAudioBtnText) playAudioBtnText.textContent = 'נגן פעיל...';
        } else {
            if (audioPlayMainIcon) audioPlayMainIcon.style.display = 'block';
            if (audioPauseMainIcon) audioPauseMainIcon.style.display = 'none';
            if (playAudioBtnText) playAudioBtnText.textContent = 'האזן לשיעור';
        }
    }

    function clearTtsParagraphHighlight() {
        if (!textContent) return;
        textContent.querySelectorAll('.tts-active-paragraph').forEach(el => {
            el.classList.remove('tts-active-paragraph');
        });
    }

    function collectTtsParagraphs() {
        if (!textContent) return [];
        return Array.from(textContent.querySelectorAll('h1.chapter-main-title, h2, h3, p[data-p-num], blockquote[data-p-num]')).filter(el => {
            if (el.closest('.in-chapter-toc, .chapter-footnotes-section, .footnotes, .related-chapters-section, .chapter-bottom-nav')) return false;
            const txt = getCleanParagraphSpeechText(el);
            return txt.length >= 4;
        });
    }

    function getCleanParagraphSpeechText(el) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.para-anchor-btn, .glossary-tooltip, .note-anchor-badge, sup, a[href^="#_ftn"], a[href^="#fn"]').forEach(n => n.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    function speakTtsParagraphAt(index) {
        if (!synth) return;
        synth.cancel();
        clearTtsParagraphHighlight();

        if (!ttsParagraphs || ttsParagraphs.length === 0) {
            ttsParagraphs = collectTtsParagraphs();
        }
        if (ttsParagraphs.length === 0 || index < 0 || index >= ttsParagraphs.length) {
            isTtsPlaying = false;
            setAudioPlayingState(false);
            if (audioProgressFill) audioProgressFill.style.width = '0%';
            return;
        }

        currentTtsParaIndex = index;
        isTtsPlaying = true;
        setAudioPlayingState(true);

        const targetEl = ttsParagraphs[currentTtsParaIndex];
        targetEl.classList.add('tts-active-paragraph');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update progress bar & paragraph counter in audio bar
        if (audioCurrentTime) audioCurrentTime.textContent = `פסקה ${currentTtsParaIndex + 1}`;
        if (audioTotalDuration) audioTotalDuration.textContent = `מתוך ${ttsParagraphs.length}`;
        if (audioProgressFill) {
            const pct = ((currentTtsParaIndex + 1) / ttsParagraphs.length) * 100;
            audioProgressFill.style.width = `${pct}%`;
        }

        const speechText = getCleanParagraphSpeechText(targetEl);
        utterance = new SpeechSynthesisUtterance(speechText);
        const isFrenchBook = activeBook && (activeBook.title.includes('(FR)') || activeBook.title.includes('Hébreu'));
        utterance.lang = isFrenchBook ? 'fr-FR' : 'he-IL';
        utterance.rate = speedRates[currentSpeedIndex] * 0.95;

        const voices = synth.getVoices();
        const targetLangPrefix = isFrenchBook ? 'fr' : 'he';
        const matchedVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(targetLangPrefix));
        if (matchedVoice) utterance.voice = matchedVoice;

        utterance.onend = () => {
            if (!isTtsPlaying) return;
            if (currentTtsParaIndex + 1 < ttsParagraphs.length) {
                speakTtsParagraphAt(currentTtsParaIndex + 1);
            } else {
                isTtsPlaying = false;
                clearTtsParagraphHighlight();
                setAudioPlayingState(false);
            }
        };

        utterance.onerror = () => {
            if (!isTtsPlaying) return;
            if (currentTtsParaIndex + 1 < ttsParagraphs.length) {
                speakTtsParagraphAt(currentTtsParaIndex + 1);
            } else {
                isTtsPlaying = false;
                clearTtsParagraphHighlight();
                setAudioPlayingState(false);
            }
        };

        synth.speak(utterance);
    }

    window.jumpTtsToParagraphElement = function(paraEl) {
        ttsParagraphs = collectTtsParagraphs();
        const idx = ttsParagraphs.indexOf(paraEl);
        if (idx !== -1) {
            speakTtsParagraphAt(idx);
        }
    };

    function stopAllAudio() {
        if (realAudioElement) {
            realAudioElement.pause();
        }
        if (synth) {
            synth.cancel();
        }
        isTtsPlaying = false;
        clearTtsParagraphHighlight();
        setAudioPlayingState(false);
    }

    if (playAudioBtn && readerAudioPlayerBar) {
        playAudioBtn.addEventListener('click', () => {
            const isHidden = readerAudioPlayerBar.style.display === 'none' || !readerAudioPlayerBar.style.display;
            if (isHidden) {
                readerAudioPlayerBar.style.display = 'block';
                updateAudioMetadata();
            } else {
                readerAudioPlayerBar.style.display = 'none';
            }
        });
    }

    if (audioCloseBtn && readerAudioPlayerBar) {
        audioCloseBtn.addEventListener('click', () => {
            stopAllAudio();
            readerAudioPlayerBar.style.display = 'none';
        });
    }

    // Audio Modes
    if (audioModeReal && audioModeTTS) {
        audioModeReal.addEventListener('click', () => {
            if (currentAudioMode === 'real') return;
            stopAllAudio();
            currentAudioMode = 'real';
            audioModeReal.classList.add('active');
            audioModeTTS.classList.remove('active');
            if (audioModeBadge) audioModeBadge.textContent = '🎙️ הקלטה מקורית';
            if (realAudioElement && !isNaN(realAudioElement.duration)) {
                audioTotalDuration.textContent = formatTime(realAudioElement.duration);
            }
        });

        audioModeTTS.addEventListener('click', () => {
            if (currentAudioMode === 'tts') return;
            stopAllAudio();
            currentAudioMode = 'tts';
            audioModeTTS.classList.add('active');
            audioModeReal.classList.remove('active');
            ttsParagraphs = collectTtsParagraphs();
            currentTtsParaIndex = 0;
            if (audioModeBadge) audioModeBadge.textContent = '🗣️ הקראה מסונכרנת';
            if (audioCurrentTime) audioCurrentTime.textContent = 'פסקה 1';
            if (audioTotalDuration) audioTotalDuration.textContent = `מתוך ${ttsParagraphs.length || 1}`;
            if (audioProgressFill) audioProgressFill.style.width = '0%';
        });
    }

    // Real audio events
    if (realAudioElement) {
        realAudioElement.addEventListener('loadedmetadata', () => {
            if (audioTotalDuration) audioTotalDuration.textContent = formatTime(realAudioElement.duration);
        });

        realAudioElement.addEventListener('timeupdate', () => {
            if (currentAudioMode !== 'real') return;
            if (audioCurrentTime) audioCurrentTime.textContent = formatTime(realAudioElement.currentTime);
            if (audioProgressFill && realAudioElement.duration) {
                const percent = (realAudioElement.currentTime / realAudioElement.duration) * 100;
                audioProgressFill.style.width = `${percent}%`;
            }
        });

        realAudioElement.addEventListener('ended', () => {
            setAudioPlayingState(false);
            if (audioProgressFill) audioProgressFill.style.width = '0%';
            if (audioCurrentTime) audioCurrentTime.textContent = '00:00';
        });

        realAudioElement.addEventListener('play', () => setAudioPlayingState(true));
        realAudioElement.addEventListener('pause', () => setAudioPlayingState(false));
    }

    // Main Play/Pause Button
    if (audioPlayMainBtn) {
        audioPlayMainBtn.addEventListener('click', () => {
            if (currentAudioMode === 'real') {
                if (!realAudioElement) return;
                if (realAudioElement.paused) {
                    realAudioElement.play().catch(e => console.warn("Audio play prevented:", e));
                } else {
                    realAudioElement.pause();
                }
            } else {
                // Karaoke Paragraph-by-Paragraph TTS Mode
                if (isTtsPlaying) {
                    stopAllAudio();
                } else {
                    ttsParagraphs = collectTtsParagraphs();
                    if (currentTtsParaIndex >= ttsParagraphs.length) {
                        currentTtsParaIndex = 0;
                    }
                    speakTtsParagraphAt(currentTtsParaIndex);
                }
            }
        });
    }

    // Skip controls (-15s / +15s in Real mode, or Prev / Next Paragraph in TTS mode)
    if (audioSkipBackBtn) {
        audioSkipBackBtn.addEventListener('click', () => {
            if (currentAudioMode === 'real' && realAudioElement) {
                realAudioElement.currentTime = Math.max(0, realAudioElement.currentTime - 15);
            } else if (currentAudioMode === 'tts') {
                ttsParagraphs = collectTtsParagraphs();
                const prevIdx = Math.max(0, currentTtsParaIndex - 1);
                speakTtsParagraphAt(prevIdx);
            }
        });
    }
    if (audioSkipFwdBtn) {
        audioSkipFwdBtn.addEventListener('click', () => {
            if (currentAudioMode === 'real' && realAudioElement) {
                realAudioElement.currentTime = Math.min(realAudioElement.duration || 0, realAudioElement.currentTime + 15);
            } else if (currentAudioMode === 'tts') {
                ttsParagraphs = collectTtsParagraphs();
                if (currentTtsParaIndex + 1 < ttsParagraphs.length) {
                    speakTtsParagraphAt(currentTtsParaIndex + 1);
                }
            }
        });
    }

    // Playback Speed
    if (audioSpeedBtn) {
        audioSpeedBtn.addEventListener('click', () => {
            currentSpeedIndex = (currentSpeedIndex + 1) % speedRates.length;
            const rate = speedRates[currentSpeedIndex];
            audioSpeedBtn.textContent = `${rate}x`;
            if (realAudioElement) realAudioElement.playbackRate = rate;
            if (isTtsPlaying) {
                speakTtsParagraphAt(currentTtsParaIndex);
            }
        });
    }

    // Progress Bar Scrubbing (supports both Real Audio and Paragraph TTS)
    if (audioProgressTrack) {
        audioProgressTrack.addEventListener('click', (e) => {
            const rect = audioProgressTrack.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            if (currentAudioMode === 'real' && realAudioElement && realAudioElement.duration) {
                realAudioElement.currentTime = ratio * realAudioElement.duration;
            } else if (currentAudioMode === 'tts') {
                ttsParagraphs = collectTtsParagraphs();
                if (ttsParagraphs.length > 0) {
                    const targetIdx = Math.min(ttsParagraphs.length - 1, Math.floor(ratio * ttsParagraphs.length));
                    speakTtsParagraphAt(targetIdx);
                }
            }
        });
    }

    // Volume & Mute
    if (audioVolumeSlider && realAudioElement) {
        audioVolumeSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            realAudioElement.volume = vol;
            if (vol === 0) {
                if (audioVolHighIcon) audioVolHighIcon.style.display = 'none';
                if (audioVolMuteIcon) audioVolMuteIcon.style.display = 'block';
            } else {
                if (audioVolHighIcon) audioVolHighIcon.style.display = 'block';
                if (audioVolMuteIcon) audioVolMuteIcon.style.display = 'none';
            }
        });
    }
    if (audioMuteBtn && realAudioElement) {
        audioMuteBtn.addEventListener('click', () => {
            realAudioElement.muted = !realAudioElement.muted;
            if (realAudioElement.muted) {
                if (audioVolHighIcon) audioVolHighIcon.style.display = 'none';
                if (audioVolMuteIcon) audioVolMuteIcon.style.display = 'block';
            } else {
                if (audioVolHighIcon) audioVolHighIcon.style.display = 'block';
                if (audioVolMuteIcon) audioVolMuteIcon.style.display = 'none';
            }
        });
    }
        
    // Handle voices changed (sometimes needed for Chrome)
    if (synth) {
        speechSynthesis.onvoiceschanged = () => {
            if(isTtsPlaying) return; // Don't interrupt
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

        const colorBtns = document.querySelectorAll('.color-btn');
        if (colorBtns.length > 0) {
            colorBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const color = btn.dataset.color || 'gold';
                    if (currentSelectionRange) {
                        try {
                            const span = document.createElement('span');
                            span.className = `highlighted-text highlight-${color}`;
                            currentSelectionRange.surroundContents(span);
                            
                            // Save highlight with color and book/chapter information
                            const selectedText = currentSelectionRange.toString().trim();
                            const bookTitle = document.getElementById('readerBookTitle').textContent;
                            savedHighlights.push({
                                id: Date.now().toString(),
                                text: selectedText,
                                bookId: activeBook ? activeBook.id : null,
                                bookTitle: bookTitle,
                                chapterId: activeChapter ? activeChapter.id : null,
                                chapterTitle: activeChapter ? activeChapter.title : '',
                                color: color,
                                date: new Date().toLocaleDateString('he-IL')
                            });
                            localStorage.setItem('savedHighlights', JSON.stringify(savedHighlights));
                            
                        } catch(e) {
                            console.warn("Complex selection highlighting not fully supported natively");
                        }
                        
                        textContextMenu.style.display = 'none';
                        window.getSelection().removeAllRanges();
                        
                        showToast('הטקסט סומן ונשמר לאזור האישי');
                    }
                });
            });
        }

        // --- Personal Note Context Action ---
        const addNoteBtn = document.getElementById('addNoteBtn');
        const noteModal = document.getElementById('noteModal');
        const closeNoteModal = document.getElementById('closeNoteModal');
        const cancelNoteBtn = document.getElementById('cancelNoteBtn');
        const saveNoteBtn = document.getElementById('saveNoteBtn');
        const noteQuotePreview = document.getElementById('noteQuotePreview');
        const noteTextInput = document.getElementById('noteTextInput');
        let pendingNoteSelection = null;
        let pendingNoteQuote = '';

        if (addNoteBtn && noteModal) {
            addNoteBtn.addEventListener('click', () => {
                if (currentSelectionRange) {
                    pendingNoteQuote = currentSelectionRange.toString().trim();
                    pendingNoteSelection = currentSelectionRange.cloneRange();
                    if (noteQuotePreview) noteQuotePreview.textContent = `"${pendingNoteQuote}"`;
                    if (noteTextInput) noteTextInput.value = '';
                    noteModal.classList.add('active');
                    if (noteTextInput) setTimeout(() => noteTextInput.focus(), 100);
                    textContextMenu.style.display = 'none';
                }
            });

            const closeNoteModalFunc = () => {
                noteModal.classList.remove('active');
                pendingNoteSelection = null;
                pendingNoteQuote = '';
            };

            if (closeNoteModal) closeNoteModal.addEventListener('click', closeNoteModalFunc);
            if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', closeNoteModalFunc);

            if (saveNoteBtn) {
                saveNoteBtn.addEventListener('click', () => {
                    const text = noteTextInput ? noteTextInput.value.trim() : '';
                    if (!text) {
                        alert('נא להקליד הערה או תובנה.');
                        return;
                    }
                    const bookTitle = document.getElementById('readerBookTitle')?.textContent || '';
                    const chapterTitle = document.getElementById('readerChapterTitle')?.textContent || '';
                    const noteObj = {
                        id: Date.now().toString(),
                        quote: pendingNoteQuote,
                        note: text,
                        bookId: activeBook ? activeBook.id : null,
                        bookTitle: bookTitle,
                        chapterId: activeChapter ? activeChapter.id : null,
                        chapterTitle: chapterTitle,
                        date: new Date().toLocaleDateString('he-IL'),
                        timestamp: Date.now()
                    };
                    savedNotes.push(noteObj);
                    localStorage.setItem('savedNotes', JSON.stringify(savedNotes));

                    if (pendingNoteSelection) {
                        try {
                            const span = document.createElement('span');
                            span.className = 'has-user-note';
                            span.innerHTML = `${pendingNoteQuote} <span class="note-anchor-badge" title="הערה: ${text.replace(/"/g, '&quot;')}">📝</span>`;
                            pendingNoteSelection.deleteContents();
                            pendingNoteSelection.insertNode(span);
                        } catch(e) {
                            console.warn("Could not insert note badge directly:", e);
                        }
                    }

                    closeNoteModalFunc();
                    window.getSelection().removeAllRanges();
                    showToast('ההערה נשמרה בהצלחה במחברת האישית');
                });
            }
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

        const copyParaLinkBtn = document.getElementById('copyParaLinkBtn');
        if (copyParaLinkBtn) {
            copyParaLinkBtn.addEventListener('click', async () => {
                if (currentSelectionRange && activeBook && activeChapter) {
                    const node = currentSelectionRange.commonAncestorContainer;
                    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                    const paraEl = el ? el.closest('[data-p-num]') : null;
                    const pNum = paraEl ? paraEl.dataset.pNum : '1';
                    const deepHash = `#/reader/${activeBook.id}/chapter/${activeChapter.id}?p=${pNum}`;
                    const fullUrl = `${window.location.origin}${window.location.pathname}${deepHash}`;
                    try {
                        history.replaceState(null, '', deepHash);
                    } catch (err) {}
                    try {
                        await navigator.clipboard.writeText(fullUrl);
                    } catch (err) {}
                    if (paraEl) {
                        paraEl.classList.add('para-flash-highlight');
                        setTimeout(() => paraEl.classList.remove('para-flash-highlight'), 2400);
                    }
                    textContextMenu.style.display = 'none';
                    window.getSelection().removeAllRanges();
                    showToast(`🔗 הקישור הישיר לפסקה §${pNum} הועתק ללוח!`);
                }
            });
        }

        const askAiSelectionBtn = document.getElementById('askAiSelectionBtn');
        if (askAiSelectionBtn) {
            askAiSelectionBtn.addEventListener('click', () => {
                if (currentSelectionRange) {
                    const selectedText = currentSelectionRange.toString().trim();
                    textContextMenu.style.display = 'none';
                    window.getSelection().removeAllRanges();
                    if (selectedText && typeof window.openAiAssistant === 'function') {
                        const shortQuote = selectedText.length > 220 ? selectedText.slice(0, 220) + '...' : selectedText;
                        window.openAiAssistant(`הסבר את הקטע הבא מתוך דברי מניטו ומצא הקבלות בספרייה: "${shortQuote}"`, 'all');
                    }
                }
            });
        }

        const searchSelectionBtn = document.getElementById('searchSelectionBtn');
        if (searchSelectionBtn) {
            searchSelectionBtn.addEventListener('click', () => {
                if (currentSelectionRange) {
                    const selectedText = currentSelectionRange.toString().trim();
                    if (selectedText) {
                        // Return to library
                        window.location.hash = '#/';
                        
                        // Scroll to advanced search and execute search
                        setTimeout(() => {
                            const advSearchInput = document.getElementById('advSearchInput');
                            const advSearchBtn = document.getElementById('advSearchBtn');
                            if (advSearchInput && advSearchBtn) {
                                const advSearchSection = document.getElementById('advancedSearchSection');
                                if (advSearchSection) {
                                    advSearchSection.scrollIntoView({ behavior: 'smooth' });
                                }
                                advSearchInput.value = selectedText;
                                advSearchBtn.click();
                            }
                        }, 300);
                    }
                    
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

    // Hebrew Nikkud strip, quote/hyphen normalization, and index mapper helper functions
    function stripNikkud(text) {
        if (!text) return "";
        return text
            .replace(/[\u0591-\u05C7]/g, "")
            .replace(/[\u05BE]/g, "-") // Normalize Hebrew Maqaf (hyphen)
            .replace(/[\u05F4\u201D\u201C]/g, '"')
            .replace(/[\u05F3\u2019\u2018]/g, "'");
    }

    function getOriginalIndex(original, strippedIndex) {
        let strippedCount = 0;
        for (let i = 0; i < original.length; i++) {
            if (strippedCount === strippedIndex) {
                return i;
            }
            const char = original[i];
            // Skip nikkud characters
            if (char.charCodeAt(0) < 0x0591 || char.charCodeAt(0) > 0x05C7) {
                strippedCount++;
            }
        }
        return original.length;
    }

    function findOriginalRange(original, query) {
        let stripped = "";
        const map = [];
        for (let i = 0; i < original.length; i++) {
            const char = original[i];
            if (char.charCodeAt(0) < 0x0591 || char.charCodeAt(0) > 0x05C7) {
                map.push(i);
                stripped += char;
            }
        }
        const strippedQuery = query.replace(/[\u0591-\u05C7]/g, "");
        const index = stripped.toLowerCase().indexOf(strippedQuery.toLowerCase());
        if (index === -1) return null;
        
        const start = map[index];
        const end = map[index + strippedQuery.length - 1] + 1;
        return { start, end };
    }

    function makeHebrewNikkudPattern(word) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let pattern = "";
        for (let i = 0; i < escaped.length; i++) {
            const char = escaped[i];
            if (char.charCodeAt(0) >= 0x0590 && char.charCodeAt(0) <= 0x05FF) {
                pattern += char + "[\u0591-\u05C7]*";
            } else if (['"', '״', '”', '“'].includes(char)) {
                pattern += '["״”“”]';
            } else if (["'", '׳', '’', '‘'].includes(char)) {
                pattern += "['׳’’‘]";
            } else if (['-', '־'].includes(char)) {
                pattern += '[-־\\s]*'; // Match any hyphen variation or space
            } else if (char === ' ') {
                pattern += '[-־\\s]+'; // Treat spaces as potential hyphens/maqafs
            } else {
                pattern += char;
            }
        }
        return pattern;
    }

    function makeHebrewNikkudRegex(word, isExactWord) {
        const pattern = makeHebrewNikkudPattern(word);
        if (isExactWord) {
            return new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])([בהוכלמש]{0,2}${pattern})(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'gi');
        } else {
            return new RegExp(`(${pattern})`, 'gi');
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
        
        // Update dashboard statistics
        const readChapters = getReadChaptersList();
        const statsChaptersCount = document.getElementById('statsChaptersCount');
        const statsFavoritesCount = document.getElementById('statsFavoritesCount');
        const statsNotesCount = document.getElementById('statsNotesCount');
        const statsBookmarksCount = document.getElementById('statsBookmarksCount');
        const statsStreakCount = document.getElementById('statsStreakCount');
        const statsReadingMinutes = document.getElementById('statsReadingMinutes');
        if (statsChaptersCount) statsChaptersCount.textContent = readChapters.length;
        if (statsFavoritesCount) statsFavoritesCount.textContent = favoriteBooks.length;
        if (statsNotesCount) statsNotesCount.textContent = savedNotes.length;
        if (statsBookmarksCount) statsBookmarksCount.textContent = savedBookmarks.length;
        const currentStreak = localStorage.getItem('manitou_study_streak') || '1';
        const currentMins = localStorage.getItem('manitou_reading_minutes') || '0';
        if (statsStreakCount) statsStreakCount.textContent = `🔥 ${currentStreak}`;
        if (statsReadingMinutes) statsReadingMinutes.textContent = `⏱️ ${currentMins}`;

        // Render Saved Bookmarks & Reading History Timeline
        const bookmarksListEl = document.getElementById('bookmarksList');
        if (bookmarksListEl) {
            bookmarksListEl.innerHTML = '';
            if (savedBookmarks.length === 0) {
                bookmarksListEl.innerHTML = '<p style="color: var(--text-muted);">טרם שמרת סימניות. לחץ על כפתור "🔖 סימנייה" בראש כל פרק כדי לשמור מיקום לחזרה מהירה.</p>';
            } else {
                [...savedBookmarks].reverse().forEach(bm => {
                    const card = document.createElement('div');
                    card.className = 'bookmark-card';
                    card.innerHTML = `
                        <div class="bookmark-card-info">
                            <div class="bookmark-card-book">🔖 ${bm.bookTitle}</div>
                            <div class="bookmark-card-chapter">${bm.chapterTitle}${bm.pNum ? ` • <span style="color:var(--accent);">פסקה §${bm.pNum}</span>` : ''}</div>
                            <div class="bookmark-card-date">נשמר בתאריך: ${bm.date || ''}</div>
                        </div>
                        <div class="bookmark-card-actions">
                            <button type="button" class="btn btn-primary btn-sm bm-jump-btn" style="padding: 0.35rem 0.9rem; border-radius: 14px; font-size: 0.84rem; cursor: pointer;">פתח פרק ↗</button>
                            <button type="button" class="btn btn-secondary btn-sm bm-delete-btn" style="padding: 0.35rem 0.65rem; border-radius: 14px; font-size: 0.84rem; cursor: pointer;" title="הסר סימנייה">✕</button>
                        </div>
                    `;
                    card.querySelector('.bm-jump-btn')?.addEventListener('click', () => {
                        if (profileModal) profileModal.classList.remove('active');
                        if (bm.pNum) {
                            window.pendingParagraphScroll = bm.pNum;
                            window.location.hash = `#/reader/${bm.bookId}/chapter/${bm.chapterId}?p=${bm.pNum}`;
                        } else {
                            window.location.hash = `#/reader/${bm.bookId}/chapter/${bm.chapterId}`;
                        }
                    });
                    card.querySelector('.bm-delete-btn')?.addEventListener('click', () => {
                        savedBookmarks = savedBookmarks.filter(x => x.key !== bm.key);
                        localStorage.setItem('savedBookmarks', JSON.stringify(savedBookmarks));
                        updateBookmarkButtonsState();
                        renderProfileData();
                        showToast('הסימנייה הוסרה');
                    });
                    bookmarksListEl.appendChild(card);
                });
            }
        }

        const readingHistoryListEl = document.getElementById('readingHistoryList');
        if (readingHistoryListEl) {
            readingHistoryListEl.innerHTML = '';
            if (readingHistory.length === 0) {
                readingHistoryListEl.innerHTML = '<p style="color: var(--text-muted);">עדיין אין היסטוריית קריאה מתועדת.</p>';
            } else {
                readingHistory.slice(0, 30).forEach((item, idx) => {
                    const row = document.createElement('div');
                    row.className = 'history-timeline-item';
                    row.innerHTML = `
                        <div class="history-timeline-left">
                            <span class="history-timeline-idx">${idx + 1}</span>
                            <div>
                                <div class="history-timeline-book">📚 ${item.bookTitle}</div>
                                <div class="history-timeline-chapter">${item.chapterTitle}</div>
                            </div>
                        </div>
                        <div class="history-timeline-right">
                            <span class="history-timeline-date">${item.date || ''}</span>
                            <button type="button" class="btn btn-secondary btn-sm hist-jump-btn" style="padding: 0.28rem 0.8rem; border-radius: 12px; font-size: 0.82rem; cursor: pointer;">המשך קריאה ↗</button>
                        </div>
                    `;
                    row.querySelector('.hist-jump-btn')?.addEventListener('click', () => {
                        if (profileModal) profileModal.classList.remove('active');
                        window.location.hash = `#/reader/${item.bookId}/chapter/${item.chapterId}`;
                    });
                    readingHistoryListEl.appendChild(row);
                });
            }
        }

        const clearReadingHistoryBtn = document.getElementById('clearReadingHistoryBtn');
        if (clearReadingHistoryBtn) {
            clearReadingHistoryBtn.onclick = () => {
                readingHistory = [];
                localStorage.setItem('readingHistory', JSON.stringify(readingHistory));
                renderProfileData();
                showToast('היסטוריית הקריאה נוקתה');
            };
        }
        
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
                el.style.position = 'relative';
                el.innerHTML = `
                    <button class="remove-fav-btn" data-id="${book.id}" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.65); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; font-size: 0.9rem; font-weight: bold; transition: all 0.2s;" title="הסר מהמועדפים">&times;</button>
                    <div class="book-cover ${book.design}" ${bgStyle} style="height: 250px;">
                        ${overlayContent}
                    </div>
                    <h4 style="margin-top: 1rem; color: var(--text-main); font-size: 1.1rem; text-align: center;">${book.title}</h4>
                `;
                
                const removeBtn = el.querySelector('.remove-fav-btn');
                removeBtn.addEventListener('mouseenter', () => removeBtn.style.transform = 'scale(1.1)');
                removeBtn.addEventListener('mouseleave', () => removeBtn.style.transform = 'scale(1)');
                
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    favoriteBooks = favoriteBooks.filter(id => id !== book.id);
                    localStorage.setItem('favoriteBooks', JSON.stringify(favoriteBooks));
                    renderProfileData();
                    
                    // Sync with homepage favorites heart buttons
                    const favBtn = document.querySelector(`.fav-btn[data-id="${book.id}"]`);
                    if (favBtn) {
                        favBtn.classList.remove('fav-active');
                        favBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        `;
                    }
                });

                el.addEventListener('click', () => {
                    window.location.hash = `#/book/${book.id}`;
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
                el.style.position = 'relative';
                
                // Color configuration mapping
                const borderColors = {
                    gold: '#d4af37',
                    green: '#2ecc71',
                    blue: '#3498db',
                    pink: '#e74c3c'
                };
                const colorHex = borderColors[hl.color] || '#d4af37';
                
                const resolvedBookId = hl.bookId || (books.find(b => b.title === hl.bookTitle)?.id);
                const resolvedChapterId = hl.chapterId || null;

                el.innerHTML = `
                    <button class="delete-hl-btn" style="position: absolute; top: 1rem; left: 1rem; background: transparent; color: var(--text-muted); border: none; cursor: pointer; font-size: 1rem; transition: color 0.2s;" title="מחק הדגשה">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                    <p style="font-size: 1.2rem; color: var(--text-main); line-height: 1.6; font-family: var(--font-serif); margin-bottom: 1rem; border-right: 4px solid ${colorHex}; padding-right: 1rem; padding-left: 2.2rem;">
                        "${hl.text}"
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: var(--text-muted); flex-wrap: wrap; gap: 8px;">
                        <span>מתוך: <strong style="color: var(--accent);">${hl.bookTitle}${hl.chapterTitle ? ' • ' + hl.chapterTitle : ''}</strong></span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span>${hl.date}</span>
                            ${resolvedBookId ? `
                                <button class="btn btn-secondary btn-sm jump-to-hl-btn" style="padding: 0.2rem 0.65rem; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--border);">
                                    עבור לפרק ↗
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                const deleteBtn = el.querySelector('.delete-hl-btn');
                deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#e74c3c');
                deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = 'var(--text-muted)');
                deleteBtn.addEventListener('click', () => {
                    if (hl.id) {
                        savedHighlights = savedHighlights.filter(h => h.id !== hl.id);
                    } else {
                        savedHighlights = savedHighlights.filter(h => h.text !== hl.text);
                    }
                    localStorage.setItem('savedHighlights', JSON.stringify(savedHighlights));
                    renderProfileData();
                });

                const jumpHlBtn = el.querySelector('.jump-to-hl-btn');
                if (jumpHlBtn && resolvedBookId) {
                    jumpHlBtn.addEventListener('click', () => {
                        const profileModal = document.getElementById('profileModal');
                        if (profileModal) profileModal.classList.remove('active');
                        if (resolvedChapterId) {
                            window.openBookToChapter(resolvedBookId, resolvedChapterId);
                        } else {
                            window.location.hash = `#/reader/${resolvedBookId}`;
                        }
                    });
                }
                
                highlightsList.appendChild(el);
            });
        }

        // Render Personal Study Notes
        const notesList = document.getElementById('notesList');
        if (notesList) {
            notesList.innerHTML = '';
            if (savedNotes.length === 0) {
                notesList.innerHTML = '<p style="color: var(--text-muted);">טרם הוספת הערות אישיות. סמן קטע טקסט בספר ולחץ על "הערה" כדי לתעד תובנות.</p>';
            } else {
                const searchVal = (document.getElementById('notesSearchInput')?.value || '').trim().toLowerCase();
                const filteredNotes = [...savedNotes].reverse().filter(n => {
                    if (!searchVal) return true;
                    return (n.note && n.note.toLowerCase().includes(searchVal)) ||
                           (n.quote && n.quote.toLowerCase().includes(searchVal)) ||
                           (n.bookTitle && n.bookTitle.toLowerCase().includes(searchVal));
                });

                if (filteredNotes.length === 0) {
                    notesList.innerHTML = '<p style="color: var(--text-muted);">לא נמצאו הערות התואמות לחיפוש.</p>';
                } else {
                    filteredNotes.forEach(noteItem => {
                        const card = document.createElement('div');
                        card.className = 'note-item-card';
                        card.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                                <p class="note-item-quote">"${noteItem.quote}"</p>
                                <div class="note-item-actions">
                                    <button class="note-action-btn delete" title="מחק הערה">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="note-item-text">
                                <strong style="color: var(--accent); font-family: var(--font-sans); display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                    <span>📝 התובנה שלי:</span>
                                </strong>
                                <span>${noteItem.note}</span>
                            </div>
                            <div class="note-item-meta">
                                <span>מתוך: <strong style="color: var(--accent);">${noteItem.bookTitle}${noteItem.chapterTitle ? ' • ' + noteItem.chapterTitle : ''}</strong></span>
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <span>${noteItem.date}</span>
                                    ${noteItem.bookId && noteItem.chapterId ? `
                                        <button class="btn btn-secondary btn-sm jump-to-chapter-btn" style="padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--border);">
                                            עבור לפרק ↗
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;

                        const delBtn = card.querySelector('.note-action-btn.delete');
                        if (delBtn) {
                            delBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                savedNotes = savedNotes.filter(n => n.id !== noteItem.id);
                                localStorage.setItem('savedNotes', JSON.stringify(savedNotes));
                                renderProfileData();
                                showToast('ההערה נמחקה');
                            });
                        }

                        const jumpBtn = card.querySelector('.jump-to-chapter-btn');
                        if (jumpBtn) {
                            jumpBtn.addEventListener('click', () => {
                                const profileModal = document.getElementById('profileModal');
                                if (profileModal) profileModal.classList.remove('active');
                                window.openBookToChapter(noteItem.bookId, noteItem.chapterId);
                            });
                        }

                        notesList.appendChild(card);
                    });
                }
            }
        }
    }

    // Attach Notes Search Filter
    const notesSearchInput = document.getElementById('notesSearchInput');
    if (notesSearchInput) {
        notesSearchInput.addEventListener('input', () => {
            renderProfileData();
        });
    }

    // Full JSON Backup & Restore in Profile Modal
    const backupJsonBtn = document.getElementById('backupJsonBtn');
    const restoreJsonBtn = document.getElementById('restoreJsonBtn');
    const restoreJsonInput = document.getElementById('restoreJsonInput');

    if (backupJsonBtn) {
        backupJsonBtn.addEventListener('click', () => {
            const backupPayload = {
                version: 1,
                exportedAt: new Date().toISOString(),
                favoriteBooks: favoriteBooks,
                savedHighlights: savedHighlights,
                savedNotes: savedNotes,
                savedBookmarks: savedBookmarks,
                readingHistory: readingHistory,
                readChapters: getReadChaptersList(),
                studyStreak: localStorage.getItem('manitou_study_streak') || '1',
                lastStudyDay: localStorage.getItem('manitou_last_study_day') || '',
                readingMinutes: localStorage.getItem('manitou_reading_minutes') || '0',
                lastReadBookId: localStorage.getItem('lastReadBookId') || '',
                lastReadChapterId: localStorage.getItem('lastReadChapterId') || '',
                lastReadBookTitle: localStorage.getItem('lastReadBookTitle') || '',
                lastReadChapterTitle: localStorage.getItem('lastReadChapterTitle') || ''
            };
            const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `manitou-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('קובץ הגיבוי הורד בהצלחה!');
        });
    }

    if (restoreJsonBtn && restoreJsonInput) {
        restoreJsonBtn.addEventListener('click', () => {
            restoreJsonInput.click();
        });

        restoreJsonInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (Array.isArray(data.favoriteBooks)) {
                        favoriteBooks = data.favoriteBooks;
                        localStorage.setItem('favoriteBooks', JSON.stringify(favoriteBooks));
                    }
                    if (Array.isArray(data.savedHighlights)) {
                        savedHighlights = data.savedHighlights;
                        localStorage.setItem('savedHighlights', JSON.stringify(savedHighlights));
                    }
                    if (Array.isArray(data.savedNotes)) {
                        savedNotes = data.savedNotes;
                        localStorage.setItem('savedNotes', JSON.stringify(savedNotes));
                    }
                    if (Array.isArray(data.savedBookmarks)) {
                        savedBookmarks = data.savedBookmarks;
                        localStorage.setItem('savedBookmarks', JSON.stringify(savedBookmarks));
                    }
                    if (Array.isArray(data.readingHistory)) {
                        readingHistory = data.readingHistory;
                        localStorage.setItem('readingHistory', JSON.stringify(readingHistory));
                    }
                    if (Array.isArray(data.readChapters)) {
                        localStorage.setItem('readChapters', JSON.stringify(data.readChapters));
                    }
                    if (data.studyStreak) localStorage.setItem('manitou_study_streak', String(data.studyStreak));
                    if (data.lastStudyDay) localStorage.setItem('manitou_last_study_day', String(data.lastStudyDay));
                    if (data.readingMinutes) localStorage.setItem('manitou_reading_minutes', String(data.readingMinutes));
                    if (data.lastReadBookId) localStorage.setItem('lastReadBookId', String(data.lastReadBookId));
                    if (data.lastReadChapterId) localStorage.setItem('lastReadChapterId', String(data.lastReadChapterId));
                    if (data.lastReadBookTitle) localStorage.setItem('lastReadBookTitle', String(data.lastReadBookTitle));
                    if (data.lastReadChapterTitle) localStorage.setItem('lastReadChapterTitle', String(data.lastReadChapterTitle));

                    renderProfileData();
                    renderBooks(books);
                    updateResumeReadingButton();
                    showToast('הנתונים שוחזרו מהגיבוי בהצלחה!');
                } catch (err) {
                    alert('שגיאה בקריאת קובץ הגיבוי. ודא שמדובר בקובץ JSON תקין.');
                } finally {
                    restoreJsonInput.value = '';
                }
            };
            reader.readAsText(file);
        });
    }

    // Direct 1-Click Markdown Notebook Export
    const downloadNotebookMdDirectBtn = document.getElementById('downloadNotebookMdDirectBtn');
    if (downloadNotebookMdDirectBtn) {
        downloadNotebookMdDirectBtn.addEventListener('click', () => {
            const favBooksList = books.filter(b => favoriteBooks.includes(b.id)).map(b => b.title);
            let mdContent = `# יומן לימוד וסיכומי מניטו\n\n`;
            mdContent += `_נוצר בתאריך: ${new Date().toLocaleDateString('he-IL')}_\n\n`;
            mdContent += `## ספרים מועדפים (${favBooksList.length})\n`;
            favBooksList.forEach(b => { mdContent += `- ${b}\n`; });
            mdContent += `\n## מחברת הערות ותובנות (${savedNotes.length})\n\n`;
            savedNotes.forEach(n => {
                mdContent += `### ${n.bookTitle}${n.chapterTitle ? ' • ' + n.chapterTitle : ''}\n`;
                mdContent += `> "${n.quote}"\n\n`;
                mdContent += `**תובנה:** ${n.note}\n\n`;
                mdContent += `_תאריך: ${n.date}_\n\n---\n\n`;
            });
            mdContent += `\n## ציטוטים מודגשים (${savedHighlights.length})\n\n`;
            savedHighlights.forEach(hl => {
                mdContent += `> "${hl.text}"\n\n_ספר: ${hl.bookTitle}${hl.chapterTitle ? ' • ' + hl.chapterTitle : ''} | ${hl.date}_\n\n---\n\n`;
            });

            const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `מחברת_לימוד_מניטו_${new Date().toISOString().slice(0, 10)}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('📄 מחברת הלימוד והציטוטים הורדה כקובץ Markdown!');
        });
    }

    // Profile Export & Print Handling
    const exportProfileBtn = document.getElementById('exportProfileBtn');
    if (exportProfileBtn) {
        exportProfileBtn.addEventListener('click', () => {
            const favBooksList = books.filter(b => favoriteBooks.includes(b.id)).map(b => b.title);
            
            const printWindow = window.open('', '_blank', 'width=950,height=850');
            if (!printWindow) {
                alert('נא לאפשר חלונות קופצים בדפדפן כדי לייצא או להדפיס.');
                return;
            }

            let highlightsHtml = '';
            if (savedHighlights.length === 0) {
                highlightsHtml = '<p style="color: #666;">אין ציטוטים מודגשים שמורים.</p>';
            } else {
                savedHighlights.forEach(hl => {
                    highlightsHtml += `
                        <div style="margin-bottom: 15px; padding: 12px 18px; border-right: 4px solid #d4af37; background: #fdfaf3; border-radius: 6px;">
                            <blockquote style="margin: 0 0 6px 0; font-size: 1.15rem; font-family: 'Frank Ruhl Libre', serif; line-height: 1.6;">
                                "${hl.text}"
                            </blockquote>
                            <small style="color: #888;">ספר: <strong>${hl.bookTitle}</strong> • תאריך: ${hl.date}</small>
                        </div>
                    `;
                });
            }

            let notesHtml = '';
            if (savedNotes.length === 0) {
                notesHtml = '<p style="color: #666;">אין הערות אישיות שמורות.</p>';
            } else {
                savedNotes.forEach(n => {
                    notesHtml += `
                        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-right: 4px solid #2ecc71; border-radius: 8px; background: #fff;">
                            <div style="font-size: 1rem; color: #555; font-style: italic; margin-bottom: 8px; font-family: 'Frank Ruhl Libre', serif;">"${n.quote}"</div>
                            <div style="font-size: 1.05rem; color: #222; font-weight: 500; margin-bottom: 8px; line-height: 1.5;">${n.note}</div>
                            <div style="font-size: 0.85rem; color: #888; border-top: 1px dashed #eee; padding-top: 6px;">
                                ספר: <strong>${n.bookTitle}${n.chapterTitle ? ' • ' + n.chapterTitle : ''}</strong> • ${n.date}
                            </div>
                        </div>
                    `;
                });
            }

            let mdContent = `# יומן לימוד וסיכומי מניטו - אור ממן\\n\\n`;
            mdContent += `_נוצר בתאריך: ${new Date().toLocaleDateString('he-IL')}_\\n\\n`;
            mdContent += `## ספרים מועדפים (${favBooksList.length})\\n`;
            favBooksList.forEach(b => mdContent += `- ${b}\\n`);
            mdContent += `\\n## ציטוטים מודגשים (${savedHighlights.length})\\n\\n`;
            savedHighlights.forEach(hl => {
                mdContent += `> "${hl.text}"\\n\\n_ספר: ${hl.bookTitle} | ${hl.date}_\\n\\n---\\n\\n`;
            });
            mdContent += `\\n## מחברת הערות ותובנות (${savedNotes.length})\\n\\n`;
            savedNotes.forEach(n => {
                mdContent += `### ${n.bookTitle}${n.chapterTitle ? ' • ' + n.chapterTitle : ''}\\n`;
                mdContent += `> ${n.quote}\\n\\n`;
                mdContent += `**תובנה:** ${n.note}\\n\\n`;
                mdContent += `_תאריך: ${n.date}_\\n\\n---\\n\\n`;
            });

            const htmlContent = `
                <!DOCTYPE html>
                <html lang="he" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>יומן לימוד אישי - מכון מניטו</title>
                    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Heebo', sans-serif; margin: 40px; color: #222; line-height: 1.6; }
                        h1 { font-family: 'Frank Ruhl Libre', serif; color: #8b5a2b; margin-bottom: 4px; font-size: 2.2rem; }
                        h2 { font-family: 'Frank Ruhl Libre', serif; border-bottom: 2px solid #d4af37; padding-bottom: 6px; margin-top: 30px; color: #222; font-size: 1.5rem; }
                        .no-print { margin-bottom: 25px; display: flex; gap: 15px; }
                        button { padding: 10px 22px; font-size: 1rem; border-radius: 25px; cursor: pointer; border: 1px solid #d4af37; font-weight: bold; font-family: 'Heebo', sans-serif; }
                        .btn-print { background: #d4af37; color: white; border: none; }
                        .btn-download { background: #fdfaf3; color: #8b5a2b; }
                        @media print {
                            .no-print { display: none; }
                            body { margin: 15mm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print">
                        <button class="btn-print" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
                        <button class="btn-download" id="downloadMdBtn">💾 הורד קובץ Markdown (.md)</button>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                        <div>
                            <h1>מכון מניטו • יומן לימוד אישי</h1>
                            <div style="color: #666; font-size: 1.1rem;">תלמיד: <strong>אור ממן</strong></div>
                        </div>
                        <div style="color: #888; font-size: 0.95rem;">
                            תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}
                        </div>
                    </div>

                    <div style="display: flex; gap: 15px; margin-top: 20px;">
                        <div style="padding: 10px 18px; background: #fdfaf3; border-radius: 8px; border: 1px solid #d4af37;">
                            <strong>${favBooksList.length}</strong> ספרים מועדפים
                        </div>
                        <div style="padding: 10px 18px; background: #fdfaf3; border-radius: 8px; border: 1px solid #d4af37;">
                            <strong>${savedHighlights.length}</strong> ציטוטים מודגשים
                        </div>
                        <div style="padding: 10px 18px; background: #fdfaf3; border-radius: 8px; border: 1px solid #d4af37;">
                            <strong>${savedNotes.length}</strong> הערות אישיות
                        </div>
                    </div>

                    <h2>ההערות והתובנות שלי</h2>
                    ${notesHtml}

                    <h2>ציטוטים מודגשים</h2>
                    ${highlightsHtml}

                    <h2>ספרים מועדפים</h2>
                    <ul>
                        ${favBooksList.length > 0 ? favBooksList.map(b => `<li>${b}</li>`).join('') : '<li>טרם נוספו ספרים מועדפים</li>'}
                    </ul>

                    <script>
                        document.getElementById('downloadMdBtn').addEventListener('click', () => {
                            const blob = new Blob([${JSON.stringify(mdContent)}], { type: 'text/markdown;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'יומן_לימוד_מניטו_אור_ממן.md';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        });
                    <\/script>
                </body>
                </html>
            `;

            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        });
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
        
        // Store search query/mode for the router to highlight once loaded
        if (searchQuery) {
            window.tempSearchQuery = searchQuery;
            window.tempSearchMode = searchMode;
        }
        
        // Navigate via router hash to keep state clean
        window.location.hash = `#/reader/${bookId}/chapter/${chapterId}`;
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
            
            let hasMatch = false;
            if (searchMode === 'exact_word') {
                const regex = makeHebrewNikkudRegex(searchWords[0], true);
                if (regex.test(text)) hasMatch = true;
            } else {
                searchWords.forEach(word => {
                    const regex = makeHebrewNikkudRegex(word, false);
                    if (regex.test(text)) hasMatch = true;
                });
            }
            
            if (!hasMatch) return;
            
            let regex;
            if (searchMode === 'exact_word') {
                regex = makeHebrewNikkudRegex(searchWords[0], true);
            } else {
                const sortedWords = [...searchWords].sort((a, b) => b.length - a.length);
                const patterns = sortedWords.map(w => makeHebrewNikkudPattern(w));
                regex = new RegExp(`(${patterns.join('|')})`, 'gi');
            }
            
            const parts = text.split(regex);
            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    const isPartMatch = searchMode === 'exact_word'
                        ? (stripNikkud(part.toLowerCase()) === stripNikkud(searchWords[0].toLowerCase()))
                        : (searchWords.some(w => stripNikkud(w.toLowerCase()) === stripNikkud(part.toLowerCase())));
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
            cycleTheme();
        });
    }

    // --- Client-Side Hash Router ---
    async function handleRoute() {
        const hash = window.location.hash || '#/';
        
        // Close modal and reader modes by default
        modal.classList.remove('active');
        profileModal.classList.remove('active');
        readerMode.style.display = 'none';
        document.body.classList.remove('reader-open');
        const timelineModal = document.getElementById('timelineModal');
        if (timelineModal && hash !== '#/timeline') timelineModal.style.display = 'none';
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
            
            filterBooks('all', searchInput ? searchInput.value.toLowerCase() : '');
            
        } else if (hash.startsWith('#/book/')) {
            const bookId = Number(hash.split('#/book/')[1]);
            const book = books.find(b => b.id === bookId);
            if (book) {
                filterBooks('all', searchInput ? searchInput.value.toLowerCase() : '');
                openModal(book);
            } else {
                window.location.hash = '#/';
            }
        } else if (hash.startsWith('#/reader/')) {
            const [cleanHashPath, queryStr] = hash.split('?');
            const pathParts = cleanHashPath.split('/');
            const bookId = Number(pathParts[2]);
            const book = books.find(b => b.id === bookId);
            if (queryStr) {
                const params = new URLSearchParams(queryStr);
                if (params.get('p')) {
                    window.pendingParagraphScroll = params.get('p');
                }
            }
            
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
            filterBooks('all', searchInput ? searchInput.value.toLowerCase() : '');
            profileModal.classList.add('active');
            renderProfileData();
        } else if (hash === '#/about') {
            const aboutLink = document.querySelector('.nav-links a[href="#/about"]');
            const drawerAboutLink = document.getElementById('drawer-link-about');
            if (aboutLink) aboutLink.classList.add('active');
            if (drawerAboutLink) drawerAboutLink.classList.add('active');
            
            const heroSubtitle = document.querySelector('.hero-subtitle');
            if (heroSubtitle) heroSubtitle.scrollIntoView({ behavior: 'smooth' });
        } else if (hash === '#/timeline') {
            const timelineLink = document.getElementById('navTimelineLink');
            const drawerTimelineLink = document.getElementById('drawer-link-timeline');
            if (timelineLink) timelineLink.classList.add('active');
            if (drawerTimelineLink) drawerTimelineLink.classList.add('active');
            if (window.openTimelineModal) window.openTimelineModal();
        } else if (hash === '#/transcripts') {
            const trLink = document.getElementById('navTranscriptsLink');
            const drawerTrLink = document.getElementById('drawer-link-transcripts');
            if (trLink) trLink.classList.add('active');
            if (drawerTrLink) drawerTrLink.classList.add('active');
            const trSection = document.getElementById('transcriptsSection');
            if (trSection) {
                setTimeout(() => trSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
            }
            if (typeof window.openTranscriptsModal === 'function') {
                window.openTranscriptsModal();
            }
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
    
    // Auto-scroll the reader content area to the current browser search (Ctrl+F) selection.
    // This fixes a known macOS/browser bug where native find-in-page highlights do not scroll inside overflow-y containers.
    document.addEventListener('selectionchange', () => {
        if (readerMode && readerMode.style.display !== 'none') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const commonAncestor = range.commonAncestorContainer;
                
                // Only scroll if the search selection is inside our reading pane
                if (textContent && textContent.contains(commonAncestor)) {
                    const rect = range.getBoundingClientRect();
                    if (rect.height > 0) {
                        const readerContentArea = document.querySelector('.reader-content-area');
                        if (readerContentArea) {
                            const containerRect = readerContentArea.getBoundingClientRect();
                            // If the selection is above or below the current scroll viewport bounds, scroll to it
                            if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
                                const offset = rect.top - containerRect.top;
                                // Center the matched word vertically inside the scrollable reader container
                                readerContentArea.scrollTop += offset - (containerRect.height / 2) + (rect.height / 2);
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Floating Scroll to Top button logic
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const readerContentArea = document.querySelector('.reader-content-area');
    if (scrollToTopBtn && readerContentArea) {
        readerContentArea.addEventListener('scroll', () => {
            if (readerContentArea.scrollTop > 500) {
                scrollToTopBtn.style.display = 'flex';
                // Trigger transition reflow
                setTimeout(() => scrollToTopBtn.classList.add('visible'), 10);
            } else {
                scrollToTopBtn.classList.remove('visible');
                // Hide after transition ends
                setTimeout(() => {
                    if (!scrollToTopBtn.classList.contains('visible')) {
                        scrollToTopBtn.style.display = 'none';
                    }
                }, 300);
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            readerContentArea.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Keyboard shortcuts inside reader mode
    document.addEventListener('keydown', (e) => {
        if (readerMode && readerMode.style.display !== 'none') {
            // Disable navigation keys if typing inside inputs
            if (document.activeElement && (
                document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA' || 
                document.activeElement.isContentEditable
            )) {
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                window.location.hash = '#/';
            } else if (e.key === 'ArrowLeft') {
                // Next chapter in RTL (goes left-ward)
                navigateChapter(1);
            } else if (e.key === 'ArrowRight') {
                // Prev chapter in RTL (goes right-ward)
                navigateChapter(-1);
            }
        }
    });

    function navigateChapter(direction) {
        if (!activeBook || !activeChapter || !activeChaptersList || activeChaptersList.length === 0) return;
        const currentIndex = activeChaptersList.findIndex(c => c.id === activeChapter.id);
        if (currentIndex === -1) return;

        const nextIndex = currentIndex + direction;
        if (nextIndex >= 0 && nextIndex < activeChaptersList.length) {
            const nextChapter = activeChaptersList[nextIndex];
            window.location.hash = `#/reader/${activeBook.id}/chapter/${nextChapter.id}`;
        }
    }
    
    // --- Manitou Glossary System ---
    function setupGlossaryModal() {
        const glossaryModal = document.getElementById('glossaryModal');
        const closeGlossaryModal = document.getElementById('closeGlossaryModal');
        const navGlossaryBtn = document.getElementById('navGlossaryBtn');
        const drawerGlossaryBtn = document.getElementById('drawerGlossaryBtn');
        const readerGlossaryBtn = document.getElementById('readerGlossaryBtn');
        const glossaryGrid = document.getElementById('glossaryGrid');
        const glossarySearchInput = document.getElementById('glossarySearchInput');
        const glossaryTotalCount = document.getElementById('glossaryTotalCount');
        const categoryPills = document.querySelectorAll('.glossary-pill');

        let currentGlossaryCategory = 'all';

        if (glossaryTotalCount) {
            glossaryTotalCount.textContent = MANITOU_GLOSSARY.length;
        }

        function renderGlossaryCards(category = 'all', searchQuery = '') {
            if (!glossaryGrid) return;
            glossaryGrid.innerHTML = '';
            const q = searchQuery.trim().toLowerCase();

            const filtered = MANITOU_GLOSSARY.filter(item => {
                const matchesCat = (category === 'all') || (item.category === category);
                const matchesSearch = !q || 
                    item.term.toLowerCase().includes(q) || 
                    item.shortDef.toLowerCase().includes(q) || 
                    item.fullDesc.toLowerCase().includes(q);
                return matchesCat && matchesSearch;
            });

            if (filtered.length === 0) {
                glossaryGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                        <p style="font-size: 1.2rem;">לא נמצאו מושגים התואמים את החיפוש "${searchQuery}".</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'glossary-card';
                card.id = `glossary-card-${encodeURIComponent(item.term)}`;
                card.innerHTML = `
                    <div>
                        <div class="glossary-card-header">
                            <h3 class="glossary-card-title">${item.term}</h3>
                            <span class="glossary-card-cat">${item.catName}</span>
                        </div>
                        <p class="glossary-card-desc">
                            <strong>${item.shortDef}</strong><br>
                            <span style="display: block; margin-top: 6px; color: var(--text-muted); font-size: 0.95rem;">${item.fullDesc}</span>
                        </p>
                    </div>
                    <div class="glossary-card-footer">
                        <button class="glossary-action-btn search-term-btn" title="חפש מושג זה בכל הספרים">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <span>חפש בספרים</span>
                        </button>
                        <button class="glossary-action-btn copy-term-btn" title="העתק הגדרה">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span>העתק</span>
                        </button>
                    </div>
                `;

                // Search in books
                const searchBtn = card.querySelector('.search-term-btn');
                if (searchBtn) {
                    searchBtn.addEventListener('click', () => {
                        if (glossaryModal) glossaryModal.classList.remove('active');
                        // Close reader if open
                        const readerMode = document.getElementById('readerMode');
                        if (readerMode && readerMode.style.display !== 'none') {
                            window.location.hash = '#/';
                        }
                        const advInput = document.getElementById('advSearchInput');
                        const advBtn = document.getElementById('advSearchBtn');
                        const advSection = document.getElementById('advancedSearchSection');
                        
                        // Select exact_word mode
                        const exactWordBtn = document.querySelector('#advSearchToolbar button[data-mode="exact_word"]');
                        if (exactWordBtn) exactWordBtn.click();

                        if (advInput) advInput.value = item.term;
                        if (advSection) advSection.scrollIntoView({ behavior: 'smooth' });
                        if (advBtn) setTimeout(() => advBtn.click(), 300);
                    });
                }

                // Copy to clipboard
                const copyBtn = card.querySelector('.copy-term-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        const copyText = `${item.term} (במשנת מניטו):\n${item.shortDef}\n${item.fullDesc}`;
                        navigator.clipboard.writeText(copyText).then(() => {
                            showToast(`ההגדרה של "${item.term}" הועתקה ללוח`);
                        });
                    });
                }

                glossaryGrid.appendChild(card);
            });
        }

        window.openGlossaryModal = function(termName = '') {
            if (!glossaryModal) return;
            glossaryModal.classList.add('active');
            if (glossarySearchInput) glossarySearchInput.value = termName;
            currentGlossaryCategory = 'all';
            categoryPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'all'));
            renderGlossaryCards('all', termName);

            if (termName) {
                setTimeout(() => {
                    const card = document.getElementById(`glossary-card-${encodeURIComponent(termName)}`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.style.borderColor = 'var(--accent)';
                        card.style.boxShadow = '0 0 15px rgba(212,175,55,0.4)';
                    }
                }, 150);
            }
        };

        if (closeGlossaryModal && glossaryModal) {
            closeGlossaryModal.addEventListener('click', () => {
                glossaryModal.classList.remove('active');
            });
            glossaryModal.addEventListener('click', (e) => {
                if (e.target === glossaryModal) {
                    glossaryModal.classList.remove('active');
                }
            });
        }

        if (navGlossaryBtn) {
            navGlossaryBtn.addEventListener('click', () => window.openGlossaryModal());
        }
        if (drawerGlossaryBtn) {
            drawerGlossaryBtn.addEventListener('click', () => {
                const mobileDrawer = document.getElementById('mobileDrawer');
                const drawerOverlay = document.getElementById('drawerOverlay');
                if (mobileDrawer) mobileDrawer.classList.remove('open');
                if (drawerOverlay) drawerOverlay.classList.remove('active');
                window.openGlossaryModal();
            });
        }
        if (readerGlossaryBtn) {
            readerGlossaryBtn.addEventListener('click', () => window.openGlossaryModal());
        }

        if (glossarySearchInput) {
            glossarySearchInput.addEventListener('input', (e) => {
                renderGlossaryCards(currentGlossaryCategory, e.target.value);
            });
        }

        categoryPills.forEach(pill => {
            pill.addEventListener('click', () => {
                categoryPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentGlossaryCategory = pill.dataset.cat || 'all';
                renderGlossaryCards(currentGlossaryCategory, glossarySearchInput ? glossarySearchInput.value : '');
            });
        });

        // Initial render
        renderGlossaryCards('all', '');
    }

    // --- Spotlight Quick Search (⌘K / Ctrl+K) ---
    function setupQuickSearch() {
        const quickSearchModal = document.getElementById('quickSearchModal');
        const quickSearchBackdrop = document.getElementById('quickSearchBackdrop');
        const spotlightSearchInput = document.getElementById('spotlightSearchInput');
        const closeSpotlightKbd = document.getElementById('closeSpotlightKbd');
        const spotlightResults = document.getElementById('spotlightResults');
        const spotlightQuickTags = document.getElementById('spotlightQuickTags');
        const navQuickSearchBtn = document.getElementById('navQuickSearchBtn');
        const readerQuickSearchBtn = document.getElementById('readerQuickSearchBtn');
        const drawerQuickSearchBtn = document.getElementById('drawerQuickSearchBtn');
        const spotlightScopeBtns = document.querySelectorAll('#spotlightScopePills .scope-pill-btn');

        let selectedIndex = -1;
        let spotlightScope = 'both'; // 'both' | 'books' | 'transcripts'

        spotlightScopeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                spotlightScopeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                spotlightScope = btn.dataset.scope || 'both';
                executeQuickSearch(spotlightSearchInput ? spotlightSearchInput.value : '');
                if (spotlightSearchInput) spotlightSearchInput.focus();
            });
        });

        window.openQuickSearch = function(initialQuery = '') {
            if (!quickSearchModal) return;
            quickSearchModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (spotlightSearchInput) {
                spotlightSearchInput.value = initialQuery;
                setTimeout(() => {
                    spotlightSearchInput.focus();
                    if (initialQuery) spotlightSearchInput.select();
                }, 50);
            }
            executeQuickSearch(initialQuery);
        };

        window.closeQuickSearch = function() {
            if (!quickSearchModal) return;
            quickSearchModal.style.display = 'none';
            document.body.style.overflow = '';
            selectedIndex = -1;
        };

        // Global hotkey: Cmd+K or Ctrl+K
        window.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (quickSearchModal && quickSearchModal.style.display === 'flex') {
                    window.closeQuickSearch();
                } else {
                    window.openQuickSearch();
                }
            } else if (e.key === 'Escape' && quickSearchModal && quickSearchModal.style.display === 'flex') {
                window.closeQuickSearch();
            }
        });

        if (navQuickSearchBtn) {
            navQuickSearchBtn.addEventListener('click', () => window.openQuickSearch());
        }
        if (readerQuickSearchBtn) {
            readerQuickSearchBtn.addEventListener('click', () => window.openQuickSearch());
        }
        if (drawerQuickSearchBtn) {
            drawerQuickSearchBtn.addEventListener('click', () => {
                const drawer = document.getElementById('mobileDrawer');
                const overlay = document.getElementById('drawerOverlay');
                if (drawer) drawer.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
                window.openQuickSearch();
            });
        }
        if (quickSearchBackdrop) {
            quickSearchBackdrop.addEventListener('click', window.closeQuickSearch);
        }
        if (closeSpotlightKbd) {
            closeSpotlightKbd.addEventListener('click', window.closeQuickSearch);
        }

        // Quick tags
        if (spotlightQuickTags) {
            spotlightQuickTags.querySelectorAll('.spotlight-tag-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const searchVal = btn.dataset.search || btn.textContent.trim();
                    if (spotlightSearchInput) spotlightSearchInput.value = searchVal;
                    executeQuickSearch(searchVal);
                });
            });
        }

        // Input search listener
        if (spotlightSearchInput) {
            spotlightSearchInput.addEventListener('input', (e) => {
                executeQuickSearch(e.target.value);
            });

            spotlightSearchInput.addEventListener('keydown', (e) => {
                const items = spotlightResults.querySelectorAll('.spotlight-item');
                if (!items.length) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % items.length;
                    updateItemHighlight(items);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                    updateItemHighlight(items);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && selectedIndex < items.length) {
                        items[selectedIndex].click();
                    } else if (items[0]) {
                        items[0].click();
                    }
                }
            });
        }

        function updateItemHighlight(items) {
            items.forEach((item, idx) => {
                if (idx === selectedIndex) {
                    item.classList.add('active');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('active');
                }
            });
        }

        function highlightMatch(text, query) {
            if (!query || !text) return text || '';
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        }

        function executeQuickSearch(query) {
            selectedIndex = -1;
            const cleanQuery = (query || '').trim().toLowerCase();

            if (!cleanQuery) {
                renderDefaultSuggestions();
                return;
            }

            // Ensure books & transcripts are loaded in background if not yet
            if (spotlightScope !== 'transcripts' && !allBooksPreloaded) {
                ensureAllBooksLoaded().then(() => {
                    if (spotlightSearchInput && spotlightSearchInput.value.trim().toLowerCase() === cleanQuery) {
                        executeQuickSearch(cleanQuery);
                    }
                });
            }
            if (spotlightScope !== 'books' && !transcriptsArchiveLoaded) {
                ensureTranscriptsArchiveLoaded().then(() => {
                    if (spotlightSearchInput && spotlightSearchInput.value.trim().toLowerCase() === cleanQuery) {
                        executeQuickSearch(cleanQuery);
                    }
                });
            }

            const strippedQ = stripNikkud(cleanQuery);

            // 1. Search Books & Chapters (when scope is 'both' or 'books')
            let matchedBooks = [];
            let topChapters = [];
            if (spotlightScope !== 'transcripts') {
                matchedBooks = books.filter(b => 
                    (b.title && b.title.toLowerCase().includes(cleanQuery)) ||
                    (b.description && b.description.toLowerCase().includes(cleanQuery)) ||
                    (b.categoryLabel && b.categoryLabel.toLowerCase().includes(cleanQuery)) ||
                    (b.category && b.category.toLowerCase().includes(cleanQuery))
                ).slice(0, 5);

                const matchedChapters = [];
                for (const b of books) {
                    const chaps = chapterCache[b.id];
                    if (!chaps) continue;
                    for (const c of chaps) {
                        const titleMatch = c.title && stripNikkud(c.title.toLowerCase()).includes(strippedQ);
                        const textMatch = !titleMatch && c._lowerText && c._lowerText.includes(strippedQ);
                        if (titleMatch || textMatch) {
                            let snippet = '';
                            if (textMatch && c._plainText && c._lowerText) {
                                const idx = c._lowerText.indexOf(strippedQ);
                                const origIdx = idx !== -1 ? getOriginalIndex(c._plainText, idx) : 0;
                                const start = Math.max(0, origIdx - 45);
                                const end = Math.min(c._plainText.length, origIdx + 95);
                                snippet = (start > 0 ? '...' : '') + c._plainText.substring(start, end).trim() + (end < c._plainText.length ? '...' : '');
                            } else if (c._plainText) {
                                snippet = c._plainText.substring(0, 110).trim() + '...';
                            }
                            matchedChapters.push({
                                book: b,
                                chapter: c,
                                titleMatch,
                                snippet
                            });
                            if (matchedChapters.length >= 12) break;
                        }
                    }
                    if (matchedChapters.length >= 12) break;
                }
                matchedChapters.sort((a, b) => (b.titleMatch ? 1 : 0) - (a.titleMatch ? 1 : 0));
                topChapters = matchedChapters.slice(0, spotlightScope === 'books' ? 8 : 5);
            }

            // 2. Search External Transcripts (when scope is 'both' or 'transcripts')
            let topTranscripts = [];
            if (spotlightScope !== 'books') {
                const matchedTranscripts = [];
                for (const tr of transcriptsArchiveItems) {
                    const titleMatch = tr._lowerTitle && tr._lowerTitle.includes(strippedQ);
                    const catMatch = !titleMatch && tr._lowerCategory && tr._lowerCategory.includes(strippedQ);
                    const textMatch = !titleMatch && !catMatch && tr._lowerText && tr._lowerText.includes(strippedQ);
                    if (titleMatch || catMatch || textMatch) {
                        let snippet = '';
                        const plain = tr.plainText || '';
                        if (textMatch && plain && tr._lowerText) {
                            const idx = tr._lowerText.indexOf(strippedQ);
                            const origIdx = idx !== -1 ? getOriginalIndex(plain, idx) : 0;
                            const start = Math.max(0, origIdx - 45);
                            const end = Math.min(plain.length, origIdx + 95);
                            snippet = (start > 0 ? '...' : '') + plain.substring(start, end).trim() + (end < plain.length ? '...' : '');
                        } else if (plain) {
                            snippet = plain.substring(0, 110).trim() + '...';
                        }
                        matchedTranscripts.push({
                            transcript: tr,
                            titleMatch,
                            snippet
                        });
                        if (matchedTranscripts.length >= 16) break;
                    }
                }
                matchedTranscripts.sort((a, b) => (b.titleMatch ? 1 : 0) - (a.titleMatch ? 1 : 0));
                topTranscripts = matchedTranscripts.slice(0, spotlightScope === 'transcripts' ? 10 : 6);
            }

            // 3. Search Glossary Terms
            const matchedTerms = spotlightScope === 'transcripts' ? [] : MANITOU_GLOSSARY.filter(t => 
                t.term.toLowerCase().includes(cleanQuery) ||
                t.shortDef.toLowerCase().includes(cleanQuery) ||
                t.fullDesc.toLowerCase().includes(cleanQuery)
            ).slice(0, 4);

            renderSearchResults(cleanQuery, matchedBooks, topChapters, topTranscripts, matchedTerms);
        }

        function renderDefaultSuggestions() {
            let html = `
                <div class="spotlight-group-title">ספרים מומלצים</div>
            `;
            const featuredBooks = books.slice(0, 4);
            featuredBooks.forEach(book => {
                html += `
                    <div class="spotlight-item" data-type="book" data-id="${book.id}">
                        <div class="spotlight-item-icon" style="background: rgba(184, 134, 11, 0.12); color: var(--accent);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </div>
                        <div class="spotlight-item-content">
                            <div class="spotlight-item-title">${book.title}</div>
                            <div class="spotlight-item-sub">${book.categoryLabel || 'ספר'} • ${book.description.slice(0, 80)}...</div>
                        </div>
                        <span class="spotlight-item-badge">פתח קריאה</span>
                    </div>
                `;
            });

            html += `
                <div class="spotlight-group-title" style="margin-top: 1rem;">מושגי יסוד במשנת מניטו</div>
            `;
            const featuredTerms = MANITOU_GLOSSARY.slice(0, 4);
            featuredTerms.forEach(item => {
                html += `
                    <div class="spotlight-item" data-type="glossary" data-term="${item.term}">
                        <div class="spotlight-item-icon" style="background: rgba(33, 150, 243, 0.12); color: #2196f3;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </div>
                        <div class="spotlight-item-content">
                            <div class="spotlight-item-title">${item.term}</div>
                            <div class="spotlight-item-sub">${item.shortDef}</div>
                        </div>
                        <span class="spotlight-item-badge" style="border-color: rgba(33, 150, 243, 0.3);">מילון מושגים</span>
                    </div>
                `;
            });

            spotlightResults.innerHTML = html;
            attachItemClickEvents();
        }

        function renderSearchResults(query, matchedBooks, matchedChapters, matchedTranscripts, matchedTerms) {
            let html = '';
            const scopeDesc = spotlightScope === 'books'
                ? 'בספרים'
                : (spotlightScope === 'transcripts' ? 'בתמלולים' : 'בכל הספרים והתמלולים');

            // Deep text search trigger item always available
            html += `
                <div class="spotlight-item" data-type="adv-search" data-query="${query}" style="background: rgba(184, 134, 11, 0.08); border-color: rgba(184, 134, 11, 0.25);">
                    <div class="spotlight-item-icon" style="background: var(--accent); color: var(--primary-bg);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <div class="spotlight-item-content">
                        <div class="spotlight-item-title">חיפוש מתקדם עבור "${query}" ${scopeDesc}</div>
                        <div class="spotlight-item-sub">מעבר למנוע החיפוש המורחב עם סינון AND/OR/ביטוי מדויק</div>
                    </div>
                    <span class="spotlight-item-badge" style="background: var(--accent); color: var(--primary-bg); border: none;">חיפוש מלא ↵</span>
                </div>
            `;

            if (matchedBooks.length > 0) {
                html += `<div class="spotlight-group-title">📚 ספרים (${matchedBooks.length})</div>`;
                matchedBooks.forEach(book => {
                    html += `
                        <div class="spotlight-item" data-type="book" data-id="${book.id}">
                            <div class="spotlight-item-icon" style="background: rgba(184, 134, 11, 0.12); color: var(--accent);">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                            </div>
                            <div class="spotlight-item-content">
                                <div class="spotlight-item-title">${highlightMatch(book.title, query)}</div>
                                <div class="spotlight-item-sub">${book.categoryLabel || 'ספר'} • ${highlightMatch(book.description.slice(0, 80), query)}...</div>
                            </div>
                            <span class="spotlight-item-badge">קרא עכשיו</span>
                        </div>
                    `;
                });
            }

            if (matchedChapters && matchedChapters.length > 0) {
                html += `<div class="spotlight-group-title">📖 פרקים בספרים (${matchedChapters.length})</div>`;
                matchedChapters.forEach(item => {
                    html += `
                        <div class="spotlight-item" data-type="chapter" data-book-id="${item.book.id}" data-chapter-id="${item.chapter.id}" data-query="${query}">
                            <div class="spotlight-item-icon" style="background: rgba(46, 204, 113, 0.12); color: #2ecc71;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            </div>
                            <div class="spotlight-item-content">
                                <div class="spotlight-item-title">${highlightMatch(item.chapter.title, query)} <span style="font-size: 0.8rem; color: var(--accent); font-weight: 600;">(${item.book.title})</span></div>
                                <div class="spotlight-item-sub">${highlightMatch(item.snippet, query)}</div>
                            </div>
                            <span class="spotlight-item-badge" style="border-color: rgba(46, 204, 113, 0.35);">פתח פרק</span>
                        </div>
                    `;
                });
            }

            if (matchedTranscripts && matchedTranscripts.length > 0) {
                html += `<div class="spotlight-group-title">🎙️ תמלולי שיעורים ומאמרים (${matchedTranscripts.length})</div>`;
                matchedTranscripts.forEach(item => {
                    const tr = item.transcript;
                    html += `
                        <div class="spotlight-item" data-type="transcript" data-id="${tr.id}" data-query="${query}">
                            <div class="spotlight-item-icon" style="background: rgba(56, 189, 248, 0.14); color: #38bdf8;">
                                <span>🎙️</span>
                            </div>
                            <div class="spotlight-item-content">
                                <div class="spotlight-item-title">${highlightMatch(tr.title, query)} <span style="font-size: 0.78rem; color: #38bdf8; font-weight: 600;">(${tr.category || tr.sourceSite})</span></div>
                                <div class="spotlight-item-sub">${highlightMatch(item.snippet, query)}</div>
                            </div>
                            <span class="spotlight-item-badge" style="border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">קרא תמלול</span>
                        </div>
                    `;
                });
            }

            if (matchedTerms.length > 0) {
                html += `<div class="spotlight-group-title">💡 מושגים במשנת מניטו (${matchedTerms.length})</div>`;
                matchedTerms.forEach(item => {
                    html += `
                        <div class="spotlight-item" data-type="glossary" data-term="${item.term}">
                            <div class="spotlight-item-icon" style="background: rgba(33, 150, 243, 0.12); color: #2196f3;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </div>
                            <div class="spotlight-item-content">
                                <div class="spotlight-item-title">${highlightMatch(item.term, query)}</div>
                                <div class="spotlight-item-sub">${highlightMatch(item.shortDef, query)}</div>
                            </div>
                            <span class="spotlight-item-badge" style="border-color: rgba(33, 150, 243, 0.3);">הסבר מושג</span>
                        </div>
                    `;
                });
            }

            if (matchedBooks.length === 0 && (!matchedChapters || matchedChapters.length === 0) && (!matchedTranscripts || matchedTranscripts.length === 0) && matchedTerms.length === 0) {
                html += `
                    <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4; margin-bottom: 0.5rem;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <div style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">לא נמצאו תוצאות מהירות עבור "${query}"</div>
                        <div style="font-size: 0.85rem;">נסה להחליף בין "שניהם יחד / ספרים / תמלולים" או לחץ על החיפוש המתקדם למעלה.</div>
                    </div>
                `;
            }

            spotlightResults.innerHTML = html;
            attachItemClickEvents();
        }

        function attachItemClickEvents() {
            spotlightResults.querySelectorAll('.spotlight-item').forEach(item => {
                item.addEventListener('click', () => {
                    const itemType = item.dataset.type;
                    window.closeQuickSearch();

                    if (itemType === 'book') {
                        const bookId = item.dataset.id;
                        window.location.hash = `#/reader/${bookId}`;
                    } else if (itemType === 'chapter') {
                        const bookId = item.dataset.bookId;
                        const chapterId = item.dataset.chapterId;
                        const q = item.dataset.query;
                        window.openBookToChapter(bookId, chapterId, q, 'exact');
                    } else if (itemType === 'transcript') {
                        const trId = item.dataset.id;
                        const q = item.dataset.query;
                        if (typeof window.jumpToTranscriptRecord === 'function') {
                            window.jumpToTranscriptRecord(trId, q);
                        }
                    } else if (itemType === 'glossary') {
                        const term = item.dataset.term;
                        if (typeof window.openGlossaryModal === 'function') {
                            window.openGlossaryModal(term);
                        }
                    } else if (itemType === 'adv-search') {
                        const q = item.dataset.query;
                        if (typeof window.triggerAdvancedSearchWithScope === 'function') {
                            window.triggerAdvancedSearchWithScope(q, spotlightScope);
                        }
                    }
                });
            });
        }
    }

    // --- Manitou Interactive Timeline Controller ---
    function setupTimeline() {
        const timelineModal = document.getElementById('timelineModal');
        const closeTimelineBtn = document.getElementById('closeTimelineBtn');
        const navTimelineLink = document.getElementById('navTimelineLink');
        const drawerTimelineBtn = document.getElementById('drawerTimelineBtn');
        const drawerTimelineLink = document.getElementById('drawer-link-timeline');

        window.openTimelineModal = function() {
            if (!timelineModal) return;
            timelineModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        };

        window.closeTimelineModal = function() {
            if (!timelineModal) return;
            timelineModal.style.display = 'none';
            document.body.style.overflow = '';
            if (window.location.hash === '#/timeline') {
                window.location.hash = '#/';
            }
        };

        if (closeTimelineBtn) closeTimelineBtn.addEventListener('click', window.closeTimelineModal);
        if (timelineModal) {
            timelineModal.addEventListener('click', (e) => {
                if (e.target === timelineModal) window.closeTimelineModal();
            });
        }

        if (navTimelineLink) {
            navTimelineLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.hash = '#/timeline';
            });
        }
        if (drawerTimelineBtn) {
            drawerTimelineBtn.addEventListener('click', () => {
                const drawer = document.getElementById('mobileDrawer');
                const overlay = document.getElementById('drawerOverlay');
                if (drawer) drawer.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
                window.location.hash = '#/timeline';
            });
        }
        if (drawerTimelineLink) {
            drawerTimelineLink.addEventListener('click', () => {
                const drawer = document.getElementById('mobileDrawer');
                const overlay = document.getElementById('drawerOverlay');
                if (drawer) drawer.classList.remove('open');
                if (overlay) overlay.classList.remove('open');
            });
        }

        // Timeline Filter Buttons
        if (timelineModal) {
            timelineModal.querySelectorAll('.timeline-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const filterCat = btn.dataset.timelineFilter || 'all';
                    window.closeTimelineModal();
                    window.location.hash = '#/';
                    setTimeout(() => {
                        const libSection = document.getElementById('librarySection');
                        if (libSection) libSection.scrollIntoView({ behavior: 'smooth' });
                        const tabBtn = document.querySelector(`.filter-tabs button[data-filter="${filterCat}"]`);
                        if (tabBtn) tabBtn.click();
                    }, 150);
                });
            });
        }
    }

    // --- Visual Quote Card Studio Controller ---
    function setupQuoteStudio() {
        const quoteCardModal = document.getElementById('quoteCardModal');
        const closeQuoteStudioBtn = document.getElementById('closeQuoteStudioBtn');
        const quoteCardPreview = document.getElementById('quoteCardPreview');
        const studioQuoteText = document.getElementById('studioQuoteText');
        const studioQuoteSource = document.getElementById('studioQuoteSource');
        const studioInputText = document.getElementById('studioInputText');
        const studioInputSource = document.getElementById('studioInputSource');
        const downloadQuotePngBtn = document.getElementById('downloadQuotePngBtn');
        const shareQuoteWhatsappBtn = document.getElementById('shareQuoteWhatsappBtn');
        const copyQuoteImageBtn = document.getElementById('copyQuoteImageBtn');
        const createQuoteCardBtn = document.getElementById('createQuoteCardBtn');
        const createInsightCardBtn = document.getElementById('createInsightCardBtn');
        const textContextMenu = document.getElementById('textContextMenu');

        let currentTheme = 'royal';
        let currentRatio = 'square';

        window.openQuoteStudio = function(quote = '', source = '') {
            if (!quoteCardModal) return;
            const finalQuote = quote || (studioQuoteText ? studioQuoteText.textContent : 'הזהות הישראלית איננה מסתכמת בדת, אלא היא מהות אנושית כוללת – להיות עברי זה לקחת אחריות מוסרית על העולם.');
            const finalSource = source || (document.getElementById('readerBookTitle')?.textContent || 'שיעורי מניטו');
            
            if (studioQuoteText) studioQuoteText.textContent = finalQuote;
            if (studioQuoteSource) studioQuoteSource.textContent = finalSource;
            if (studioInputText) studioInputText.value = finalQuote;
            if (studioInputSource) studioInputSource.value = finalSource;

            quoteCardModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (textContextMenu) textContextMenu.style.display = 'none';
        };

        window.closeQuoteStudio = function() {
            if (!quoteCardModal) return;
            quoteCardModal.style.display = 'none';
            document.body.style.overflow = '';
        };

        if (closeQuoteStudioBtn) closeQuoteStudioBtn.addEventListener('click', window.closeQuoteStudio);
        if (quoteCardModal) {
            quoteCardModal.addEventListener('click', (e) => {
                if (e.target === quoteCardModal) window.closeQuoteStudio();
            });
        }

        // Live inputs
        if (studioInputText) {
            studioInputText.addEventListener('input', (e) => {
                if (studioQuoteText) studioQuoteText.textContent = e.target.value.trim() || '...';
            });
        }
        if (studioInputSource) {
            studioInputSource.addEventListener('input', (e) => {
                if (studioQuoteSource) studioQuoteSource.textContent = e.target.value.trim() || 'מכון מניטו';
            });
        }

        // Theme switching
        if (quoteCardModal) {
            quoteCardModal.querySelectorAll('.theme-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    quoteCardModal.querySelectorAll('.theme-option-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentTheme = btn.dataset.theme;
                    updateCardClasses();
                });
            });

            // Ratio switching
            quoteCardModal.querySelectorAll('.ratio-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    quoteCardModal.querySelectorAll('.ratio-option-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentRatio = btn.dataset.ratio;
                    updateCardClasses();
                });
            });
        }

        function updateCardClasses() {
            if (!quoteCardPreview) return;
            quoteCardPreview.className = `quote-render-card theme-${currentTheme} ratio-${currentRatio}`;
        }

        // Hook up trigger buttons
        if (createQuoteCardBtn) {
            createQuoteCardBtn.addEventListener('click', () => {
                const selectedText = window.getSelection()?.toString()?.trim();
                const bookTitle = document.getElementById('readerBookTitle')?.textContent || '';
                const rawChapterTitle = document.getElementById('readerChapterTitle')?.textContent || '';
                const chapterTitle = rawChapterTitle.split('•')[0].trim();
                const src = bookTitle ? `${bookTitle}${chapterTitle ? ' • ' + chapterTitle : ''}` : 'מתוך כתבי מניטו';
                window.openQuoteStudio(selectedText, src);
            });
        }

        if (createInsightCardBtn) {
            createInsightCardBtn.addEventListener('click', () => {
                const quote = document.getElementById('dailyInsightQuote')?.textContent?.replace(/"/g, '').trim();
                const source = document.getElementById('dailyInsightSource')?.textContent?.replace('מתוך:', '').trim();
                window.openQuoteStudio(quote, source);
            });
        }

        // Download PNG render
        if (downloadQuotePngBtn) {
            downloadQuotePngBtn.addEventListener('click', () => {
                renderAndDownloadCard(false);
            });
        }

        // WhatsApp Share
        if (shareQuoteWhatsappBtn) {
            shareQuoteWhatsappBtn.addEventListener('click', () => {
                const q = studioQuoteText ? studioQuoteText.textContent : '';
                const s = studioQuoteSource ? studioQuoteSource.textContent : '';
                const text = `"${q}"\n\n— הרב יהודא לאון אשכנזי (מניטו), ${s}\n\nלקריאה בספריית מכון מניטו: ${window.location.origin}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
            });
        }

        // Copy Image (or Text fallback) to Clipboard
        if (copyQuoteImageBtn) {
            copyQuoteImageBtn.addEventListener('click', async () => {
                renderAndDownloadCard(true);
            });
        }

        function renderAndDownloadCard(copyToClipboardOnly = false) {
            const canvas = document.getElementById('quoteRenderCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Canvas Dimensions based on ratio (high-res 2x)
            let width = 1200;
            let height = 1200;
            if (currentRatio === 'story') {
                width = 1080;
                height = 1920;
            } else if (currentRatio === 'wide') {
                width = 1200;
                height = 675;
            }

            canvas.width = width;
            canvas.height = height;

            // Palette setup
            let bgFill = '#0e1526';
            let borderColor = '#b8860b';
            let textColor = '#f8fafc';
            let accentColor = '#d4af37';
            let subColor = '#94a3b8';

            if (currentTheme === 'sepia') {
                bgFill = '#f4ecd8';
                borderColor = '#8b5a2b';
                textColor = '#2b1f13';
                accentColor = '#8b5a2b';
                subColor = '#78644e';
            } else if (currentTheme === 'stone') {
                bgFill = '#fbfaf6';
                borderColor = '#c9b084';
                textColor = '#0f172a';
                accentColor = '#926d2e';
                subColor = '#64748b';
            } else if (currentTheme === 'azure') {
                bgFill = '#0c2340';
                borderColor = '#38bdf8';
                textColor = '#ffffff';
                accentColor = '#38bdf8';
                subColor = '#93c5fd';
            }

            // Background
            ctx.fillStyle = bgFill;
            ctx.fillRect(0, 0, width, height);

            // Double Border
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 14;
            ctx.strokeRect(30, 30, width - 60, height - 60);

            ctx.lineWidth = 3;
            ctx.strokeRect(48, 48, width - 96, height - 96);

            // Corner Ornaments
            const cornerSize = 25;
            ctx.fillStyle = accentColor;
            ctx.fillRect(40, 40, cornerSize, cornerSize);
            ctx.fillRect(width - 40 - cornerSize, 40, cornerSize, cornerSize);
            ctx.fillRect(40, height - 40 - cornerSize, cornerSize, cornerSize);
            ctx.fillRect(width - 40 - cornerSize, height - 40 - cornerSize, cornerSize);

            // Quote Mark
            ctx.font = 'bold 120px "Frank Ruhl Libre", serif';
            ctx.fillStyle = accentColor;
            ctx.textAlign = 'right';
            ctx.direction = 'rtl';
            ctx.globalAlpha = 0.4;
            ctx.fillText('“', width - 90, 180);
            ctx.globalAlpha = 1.0;

            // Quote Text
            const quoteText = studioQuoteText ? studioQuoteText.textContent : '';
            ctx.fillStyle = textColor;
            ctx.font = '600 44px "Frank Ruhl Libre", "Heebo", serif';
            
            // RTL Word wrapping
            const maxWidth = width - 200;
            const lineHeight = 72;
            const words = quoteText.split(' ');
            let line = '';
            let lines = [];

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);

            let startY = (height / 2) - ((lines.length * lineHeight) / 2) + 20;
            if (currentRatio === 'story') startY = 520;
            if (startY < 240) startY = 240;

            for (let k = 0; k < lines.length; k++) {
                ctx.fillText(lines[k].trim(), width - 100, startY + (k * lineHeight));
            }

            // Divider Line
            const dividerY = height - 190;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(width - 100, dividerY);
            ctx.lineTo(100, dividerY);
            ctx.stroke();

            // Source & Author
            const sourceText = studioQuoteSource ? studioQuoteSource.textContent : 'מספד למשיח';
            ctx.fillStyle = accentColor;
            ctx.font = 'bold 36px "Heebo", sans-serif';
            ctx.fillText(sourceText, width - 100, dividerY + 60);

            ctx.fillStyle = subColor;
            ctx.font = '500 28px "Heebo", sans-serif';
            ctx.fillText('הרב יהודא לאון אשכנזי (מניטו)', width - 100, dividerY + 110);

            // Emblem
            ctx.textAlign = 'left';
            ctx.fillStyle = accentColor;
            ctx.font = 'bold 28px "Heebo", sans-serif';
            ctx.fillText('מכון מניטו • ספרייה מקוונת', 100, dividerY + 70);

            // Export to PNG or Copy Image to Clipboard
            if (copyToClipboardOnly) {
                if (canvas.toBlob && navigator.clipboard && window.ClipboardItem) {
                    canvas.toBlob(async (blob) => {
                        try {
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                            showToast('🖼️ תמונת הציטוט הועתקה ללוח! (אפשר להדביק ישירות בוואטסאפ)');
                        } catch (err) {
                            const q = studioQuoteText ? studioQuoteText.textContent : '';
                            const s = studioQuoteSource ? studioQuoteSource.textContent : '';
                            await navigator.clipboard.writeText(`"${q}"\n— הרב יהודא לאון אשכנזי (מניטו), ${s}`);
                            showToast('טקסט הציטוט הועתק ללוח!');
                        }
                    }, 'image/png');
                } else {
                    const q = studioQuoteText ? studioQuoteText.textContent : '';
                    const s = studioQuoteSource ? studioQuoteSource.textContent : '';
                    navigator.clipboard.writeText(`"${q}"\n— הרב יהודא לאון אשכנזי (מניטו), ${s}`).catch(() => {});
                    showToast('טקסט הציטוט הועתק ללוח!');
                }
                return;
            }

            const link = document.createElement('a');
            link.download = `manitou-quote-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast('תמונת הציטוט הורדה בהצלחה!');
        }
    }

    // --- Daily Study Streak & Reading Minutes Tracker ---
    function setupStudyStreak() {
        const todayStr = new Date().toISOString().slice(0, 10);
        let lastStudyDay = localStorage.getItem('manitou_last_study_day');
        let streak = parseInt(localStorage.getItem('manitou_study_streak') || '1', 10);
        let readingMinutes = parseInt(localStorage.getItem('manitou_reading_minutes') || '0', 10);

        if (!lastStudyDay) {
            streak = 1;
            localStorage.setItem('manitou_last_study_day', todayStr);
            localStorage.setItem('manitou_study_streak', '1');
        } else if (lastStudyDay !== todayStr) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);

            if (lastStudyDay === yesterdayStr) {
                streak += 1;
            } else {
                streak = 1;
            }
            localStorage.setItem('manitou_last_study_day', todayStr);
            localStorage.setItem('manitou_study_streak', String(streak));
        }

        function updateStreakUI() {
            const navStreakText = document.getElementById('navStreakText');
            const statsStreakCount = document.getElementById('statsStreakCount');
            const statsReadingMinutes = document.getElementById('statsReadingMinutes');

            if (navStreakText) navStreakText.textContent = `יום ${streak}`;
            if (statsStreakCount) statsStreakCount.textContent = `🔥 ${streak}`;
            if (statsReadingMinutes) statsReadingMinutes.textContent = `⏱️ ${readingMinutes}`;
        }

        updateStreakUI();

        // Increment reading minutes every 60s when reader is active
        setInterval(() => {
            const readerMode = document.getElementById('readerMode');
            if (readerMode && readerMode.style.display !== 'none') {
                readingMinutes += 1;
                localStorage.setItem('manitou_reading_minutes', String(readingMinutes));
                updateStreakUI();
            }
        }, 60000);
    }

    // --- Parasha, Holidays & Topics Index Modal ---
    function setupTopicsModal() {
        const topicsModal = document.getElementById('topicsModal');
        const closeTopicsModal = document.getElementById('closeTopicsModal');
        const navTopicsBtn = document.getElementById('navTopicsBtn');
        const heroTopicsBtn = document.getElementById('heroTopicsBtn');
        const drawerTopicsBtn = document.getElementById('drawerTopicsBtn');
        const topicsModalBody = document.getElementById('topicsModalBody');
        const topicsSearchInput = document.getElementById('topicsSearchInput');
        const groupFilterBtns = document.querySelectorAll('#topicsGroupFilters .glossary-pill');

        let topicsData = null;
        let activeGroup = 'all';
        let currentQuery = '';

        async function loadTopicsData() {
            if (topicsData) return topicsData;
            try {
                const res = await fetch('data/topics_index.json');
                if (res.ok) {
                    topicsData = await res.json();
                } else {
                    topicsData = [];
                }
            } catch (e) {
                topicsData = [];
            }
            return topicsData;
        }

        function renderTopicsList() {
            if (!topicsModalBody || !topicsData) return;
            const q = currentQuery.trim().toLowerCase();

            const filteredTopics = topicsData.filter(t => {
                if (activeGroup !== 'all' && t.group !== activeGroup) return false;
                if (!q) return true;
                if (t.title.toLowerCase().includes(q) || t.groupLabel.toLowerCase().includes(q)) return true;
                return t.items.some(item =>
                    item.chapterTitle.toLowerCase().includes(q) ||
                    item.bookTitle.toLowerCase().includes(q)
                );
            });

            if (filteredTopics.length === 0) {
                topicsModalBody.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);">לא נמצאו נושאים או שיעורים תואמים לסינון.</div>`;
                return;
            }

            topicsModalBody.innerHTML = filteredTopics.map(topic => {
                const matchingItems = q
                    ? topic.items.filter(item =>
                        topic.title.toLowerCase().includes(q) ||
                        item.chapterTitle.toLowerCase().includes(q) ||
                        item.bookTitle.toLowerCase().includes(q)
                      )
                    : topic.items;

                const shownItems = matchingItems.slice(0, 12);
                return `
                    <div class="topic-section-card">
                        <div class="topic-section-header">
                            <div>
                                <span style="font-size: 0.78rem; color: var(--accent); font-weight: 700;">${topic.groupLabel}</span>
                                <h3 class="topic-section-title">${topic.title}</h3>
                            </div>
                            <span class="topic-section-badge">${matchingItems.length} שיעורים ופרקים</span>
                        </div>
                        <div class="topic-items-grid">
                            ${shownItems.map(item => `
                                <button class="topic-chapter-chip" data-book-id="${item.bookId}" data-chap-id="${item.chapterId}">
                                    <div class="topic-chip-book">
                                        <span>📚 ${item.bookTitle}</span>
                                        <span style="color: var(--text-muted); font-weight: 500;">⏱️ ${item.readingMinutes || 5} דק׳</span>
                                    </div>
                                    <div class="topic-chip-title">${item.chapterTitle}</div>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            topicsModalBody.querySelectorAll('.topic-chapter-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const bId = chip.dataset.bookId;
                    const cId = chip.dataset.chapId;
                    if (topicsModal) {
                        topicsModal.classList.remove('active');
                        document.body.style.overflow = 'auto';
                    }
                    window.location.hash = `#/reader/${bId}/chapter/${cId}`;
                });
            });
        }

        async function openTopicsModal() {
            if (!topicsModal) return;
            if (typeof closeMobileDrawer === 'function') closeMobileDrawer();
            topicsModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            topicsModalBody.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">טוען מפתח פרשות ומועדים...</div>';
            await loadTopicsData();
            renderTopicsList();
        }

        [navTopicsBtn, heroTopicsBtn, drawerTopicsBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', openTopicsModal);
        });

        if (closeTopicsModal && topicsModal) {
            closeTopicsModal.addEventListener('click', () => {
                topicsModal.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
            topicsModal.addEventListener('click', (e) => {
                if (e.target === topicsModal) {
                    topicsModal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
            });
        }

        groupFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                groupFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeGroup = btn.dataset.group || 'all';
                renderTopicsList();
            });
        });

        if (topicsSearchInput) {
            topicsSearchInput.addEventListener('input', (e) => {
                currentQuery = e.target.value;
                renderTopicsList();
            });
        }
    }

    // --- Manitou Global AI Study Assistant ("החברותא של מניטו" - RAG across all 24 books + Gemini API) ---
    function setupAiAssistant() {
        const aiModal = document.getElementById('aiAssistantModal');
        const aiBackdrop = document.getElementById('aiModalBackdrop');
        const closeAiModalBtn = document.getElementById('closeAiModalBtn');
        const navAiBtn = document.getElementById('navAiAssistantBtn');
        const heroAiBtn = document.getElementById('heroAiAssistantBtn');
        const readerAiBtn = document.getElementById('readerAiAssistantBtn');
        const drawerAiBtn = document.getElementById('drawerAiAssistantBtn');
        const floatingFab = document.getElementById('floatingAiAssistantFab');

        const aiChatMessages = document.getElementById('aiChatMessages');
        const aiChatForm = document.getElementById('aiChatForm');
        const aiChatInput = document.getElementById('aiChatInput');
        const aiChatSendBtn = document.getElementById('aiChatSendBtn');
        const aiScopePills = document.getElementById('aiScopePills');
        const aiScopeBookBtn = document.getElementById('aiScopeBookBtn');
        const aiScopeChapterBtn = document.getElementById('aiScopeChapterBtn');
        const aiSummarizeChapterChip = document.getElementById('aiSummarizeChapterChip');
        const aiIndexStatusText = document.getElementById('aiIndexStatusText');
        const aiEngineStatusBadge = document.getElementById('aiEngineStatusBadge');

        const aiToggleApiSettingsBtn = document.getElementById('aiToggleApiSettingsBtn');
        const aiApiSettingsDrawer = document.getElementById('aiApiSettingsDrawer');
        const aiGeminiKeyInput = document.getElementById('aiGeminiKeyInput');
        const saveAiGeminiKeyBtn = document.getElementById('saveAiGeminiKeyBtn');
        const clearAiGeminiKeyBtn = document.getElementById('clearAiGeminiKeyBtn');
        const aiClearHistoryBtn = document.getElementById('aiClearHistoryBtn');
        const aiModalPanel = document.getElementById('aiModalPanel');
        const aiExpandSizeBtn = document.getElementById('aiExpandSizeBtn');
        const aiExpandSizeText = document.getElementById('aiExpandSizeText');
        const aiFontIncBtn = document.getElementById('aiFontIncBtn');
        const aiFontDecBtn = document.getElementById('aiFontDecBtn');

        if (!aiModal || !aiChatMessages) return;

        let currentScope = 'all'; // 'all' | 'book' | 'chapter'
        let isBusy = false;
        let aiFontScale = parseFloat(localStorage.getItem('manitou_ai_font_scale') || '1') || 1;
        aiModal.style.setProperty('--ai-font-scale', String(aiFontScale));

        if (aiFontIncBtn) {
            aiFontIncBtn.addEventListener('click', () => {
                aiFontScale = Math.min(1.35, Math.round((aiFontScale + 0.08) * 100) / 100);
                aiModal.style.setProperty('--ai-font-scale', String(aiFontScale));
                localStorage.setItem('manitou_ai_font_scale', String(aiFontScale));
            });
        }
        if (aiFontDecBtn) {
            aiFontDecBtn.addEventListener('click', () => {
                aiFontScale = Math.max(0.85, Math.round((aiFontScale - 0.08) * 100) / 100);
                aiModal.style.setProperty('--ai-font-scale', String(aiFontScale));
                localStorage.setItem('manitou_ai_font_scale', String(aiFontScale));
            });
        }
        if (aiExpandSizeBtn && aiModalPanel) {
            aiExpandSizeBtn.addEventListener('click', () => {
                const isMax = aiModalPanel.classList.toggle('ai-panel-maximized');
                if (aiExpandSizeText) {
                    aiExpandSizeText.textContent = isMax ? 'חלון רגיל' : 'חלון רחב';
                }
            });
        }

        const HEBREW_STOP_WORDS = new Set([
            'מה', 'איך', 'כיצד', 'למה', 'מדוע', 'איפה', 'היכן', 'מתי', 'מי', 'האם',
            'את', 'של', 'על', 'עם', 'אל', 'מן', 'בתוך', 'מתוך', 'לפי', 'אצל', 'בין',
            'או', 'גם', 'רק', 'כל', 'זה', 'זו', 'זאת', 'אלה', 'אלו', 'הוא', 'היא',
            'הם', 'הן', 'אני', 'אנחנו', 'אתה', 'אתם', 'היה', 'היתה', 'יהיה', 'להיות',
            'אומר', 'מסביר', 'מבאר', 'מדבר', 'כותב', 'הרב', 'מניטו', 'אשכנזי', 'יהודא',
            'לאון', 'ספר', 'ספרים', 'פרק', 'פרקים', 'בספר', 'בפרק', 'לי', 'לנו', 'לו',
            'לה', 'להם', 'כמו', 'יותר', 'פחות', 'מאוד', 'כך', 'ככה', 'אבל', 'אלא',
            'כדי', 'שלא', 'שאלה', 'תשובה', 'הסבר', 'סכם', 'לסכם', 'מצא', 'חפש', 'בבקשה'
        ]);

        const DEFAULT_BUILTIN_GEMINI_KEY = '';
        const hasServerAiKey = Boolean(window.__MANITOU_CONFIG__ && window.__MANITOU_CONFIG__.hasServerAiKey);

        function updateEngineBadge() {
            const key = (localStorage.getItem('manitou_gemini_api_key') || DEFAULT_BUILTIN_GEMINI_KEY).trim();
            if (aiGeminiKeyInput) aiGeminiKeyInput.value = key;
            if (!aiEngineStatusBadge) return;
            if (key || hasServerAiKey) {
                aiEngineStatusBadge.textContent = '✨ Gemini AI + מנוע מקורות (24 ספרים)';
                aiEngineStatusBadge.classList.add('has-gemini');
            } else {
                aiEngineStatusBadge.textContent = 'מנוע מקורות חכם (24 ספרים • 271 פרקים)';
                aiEngineStatusBadge.classList.remove('has-gemini');
            }
        }
        updateEngineBadge();

        function syncScopeButtonsWithContext() {
            const inReader = readerMode && readerMode.style.display !== 'none' && activeBook;
            if (aiScopeBookBtn) {
                if (inReader && activeBook) {
                    aiScopeBookBtn.style.display = 'inline-flex';
                    aiScopeBookBtn.textContent = `📚 בספר "${activeBook.title}"`;
                } else {
                    aiScopeBookBtn.style.display = 'none';
                    if (currentScope === 'book') currentScope = 'all';
                }
            }
            if (aiScopeChapterBtn) {
                if (inReader && activeChapter) {
                    const cleanTitle = formatChapterDisplayTitle(activeChapter.title, activeBook);
                    aiScopeChapterBtn.style.display = 'inline-flex';
                    aiScopeChapterBtn.textContent = `📄 בפרק "${cleanTitle.slice(0, 28)}"`;
                } else {
                    aiScopeChapterBtn.style.display = 'none';
                    if (currentScope === 'chapter') currentScope = 'all';
                }
            }
            if (aiSummarizeChapterChip) {
                aiSummarizeChapterChip.style.display = (inReader && activeChapter) ? 'inline-flex' : 'none';
            }
            if (aiScopePills) {
                aiScopePills.querySelectorAll('.ai-scope-pill').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.scope === currentScope);
                });
            }
        }

        function renderWelcomeMessage() {
            aiChatMessages.innerHTML = `
                <div class="ai-msg ai-msg-assistant">
                    <div class="ai-msg-avatar">✨</div>
                    <div class="ai-msg-bubble">
                        <div class="ai-answer-summary" style="margin-bottom: 0;">
                            <div class="ai-answer-header-row">
                                <h4>ברוכים הבאים לחברותא החכמה של ספריית מניטו</h4>
                                <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">24 ספרים • 271 פרקים • 2.23M מילים</span>
                            </div>
                            <div class="ai-answer-body">
                                <p>אפשר לשאול אותי <strong>כל שאלה בשפה חופשית על כל האתר והספרייה</strong> (או למקד את החיפוש לספר/פרק ספציפי). אני סורק בזמן אמת את כל שיעורי וכתבי הרב יהודא לאון אשכנזי זצ״ל, מנסח תשובה בהירה, ומצרף <strong>ציטוטים מדויקים עם קישור ישיר לפסקה (§)</strong> בתוך הספר.</p>
                            </div>
                            <div class="ai-welcome-grid">
                                <div class="ai-welcome-feature">
                                    <strong>🌐 חיפוש רוחבי בכל האתר</strong>
                                    מאתר הקבלות ונושאים לאורך כל סדרת "סוד מדרש התולדות", "מספד למשיח", "שערי דמעה" ו"קול המועד".
                                </div>
                                <div class="ai-welcome-feature">
                                    <strong>📖 מראי מקומות מדויקים (§)</strong>
                                    לחיצה על כפתור "פתח בפסקה §" בכל מקור תקפיץ אותך ישירות לפסקה המודגשת בתוך הספר.
                                </div>
                                <div class="ai-welcome-feature">
                                    <strong>📑 סיכום וניתוח פרקים</strong>
                                    בזמן קריאת פרק בספרייה, ניתן לבחור "הפרק הנוכחי בלבד" ולבקש סיכום של נקודות היסוד.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        renderWelcomeMessage();

        window.openAiAssistant = function(initialQuestion = '', preferredScope = '') {
            if (preferredScope) {
                currentScope = preferredScope;
            }
            syncScopeButtonsWithContext();
            aiModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Preload all 24 books in background immediately when opening AI modal
            if (!allBooksPreloaded) {
                if (aiIndexStatusText) aiIndexStatusText.textContent = '⏳ טוען ומאנדקס 24 ספרים...';
                ensureAllBooksLoaded().then(() => {
                    if (aiIndexStatusText) aiIndexStatusText.textContent = '⚡ 24 ספרים ו-271 פרקים מאונדקסים';
                });
            } else if (aiIndexStatusText) {
                aiIndexStatusText.textContent = '⚡ 24 ספרים ו-271 פרקים מאונדקסים';
            }

            setTimeout(() => {
                if (aiChatInput) aiChatInput.focus();
            }, 60);

            if (initialQuestion && initialQuestion.trim()) {
                handleUserQuestion(initialQuestion.trim());
            }
        };

        window.closeAiAssistant = function() {
            aiModal.style.display = 'none';
            if (!readerMode || readerMode.style.display === 'none') {
                document.body.style.overflow = '';
            }
        };

        if (navAiBtn) navAiBtn.addEventListener('click', () => window.openAiAssistant());
        if (heroAiBtn) heroAiBtn.addEventListener('click', () => window.openAiAssistant('', 'all'));
        if (readerAiBtn) readerAiBtn.addEventListener('click', () => window.openAiAssistant());
        if (floatingFab) floatingFab.addEventListener('click', () => window.openAiAssistant());
        if (drawerAiBtn) {
            drawerAiBtn.addEventListener('click', () => {
                if (mobileDrawer) mobileDrawer.classList.remove('active');
                if (drawerOverlay) drawerOverlay.classList.remove('active');
                window.openAiAssistant('', 'all');
            });
        }
        if (closeAiModalBtn) closeAiModalBtn.addEventListener('click', window.closeAiAssistant);
        if (aiBackdrop) aiBackdrop.addEventListener('click', window.closeAiAssistant);

        // Global shortcut: Cmd+J / Ctrl+J opens AI Assistant
        window.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
                e.preventDefault();
                if (aiModal.style.display === 'flex') {
                    window.closeAiAssistant();
                } else {
                    window.openAiAssistant();
                }
            } else if (e.key === 'Escape' && aiModal.style.display === 'flex') {
                window.closeAiAssistant();
            }
        });

        // Scope Switching
        if (aiScopePills) {
            aiScopePills.addEventListener('click', (e) => {
                const pill = e.target.closest('.ai-scope-pill');
                if (!pill) return;
                currentScope = pill.dataset.scope || 'all';
                aiScopePills.querySelectorAll('.ai-scope-pill').forEach(b => b.classList.toggle('active', b === pill));
            });
        }

        // Settings Drawer
        if (aiToggleApiSettingsBtn && aiApiSettingsDrawer) {
            aiToggleApiSettingsBtn.addEventListener('click', () => {
                const isHidden = aiApiSettingsDrawer.style.display === 'none';
                aiApiSettingsDrawer.style.display = isHidden ? 'block' : 'none';
            });
        }
        if (saveAiGeminiKeyBtn && aiGeminiKeyInput) {
            saveAiGeminiKeyBtn.addEventListener('click', () => {
                const val = aiGeminiKeyInput.value.trim();
                if (val) {
                    localStorage.setItem('manitou_gemini_api_key', val);
                    updateEngineBadge();
                    if (aiApiSettingsDrawer) aiApiSettingsDrawer.style.display = 'none';
                    showToast('✨ מפתח Gemini AI נשמר! מעתה התשובות יכללו גם ניסוח AI מלא.');
                }
            });
        }
        if (clearAiGeminiKeyBtn && aiGeminiKeyInput) {
            clearAiGeminiKeyBtn.addEventListener('click', () => {
                localStorage.removeItem('manitou_gemini_api_key');
                aiGeminiKeyInput.value = '';
                updateEngineBadge();
                showToast('מפתח Gemini הוסר — עובד במנוע המקורות המקומי.');
            });
        }
        if (aiClearHistoryBtn) {
            aiClearHistoryBtn.addEventListener('click', () => {
                renderWelcomeMessage();
                showToast('השיחה נוקתה');
            });
        }

        // Suggestion Chips
        document.querySelectorAll('.ai-chip-btn').forEach(chip => {
            chip.addEventListener('click', () => {
                const q = chip.dataset.question || chip.textContent.trim();
                if (chip.id === 'aiSummarizeChapterChip' && activeChapter) {
                    currentScope = 'chapter';
                    syncScopeButtonsWithContext();
                }
                handleUserQuestion(q);
            });
        });

        // Input Submit & Enter Handling
        if (aiChatInput) {
            aiChatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (aiChatForm) aiChatForm.requestSubmit();
                }
            });
        }

        if (aiChatForm) {
            aiChatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const q = (aiChatInput ? aiChatInput.value : '').trim();
                if (!q || isBusy) return;
                if (aiChatInput) aiChatInput.value = '';
                handleUserQuestion(q);
            });
        }

        // Tokenize & extract meaningful Hebrew keywords + stem variations
        function extractQueryTokens(rawQuestion) {
            const cleaned = stripNikkud(rawQuestion.toLowerCase())
                .replace(/[^\u0590-\u05FFa-zA-Z0-9\s"']/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const rawWords = cleaned.split(' ').filter(w => w.length >= 2);
            const tokens = [];
            for (const w of rawWords) {
                const bare = w.replace(/^["']+|["']+$/g, '');
                if (!bare || HEBREW_STOP_WORDS.has(bare)) continue;
                tokens.push(bare);
                // Strip common Hebrew prefix letter (ה, ו, ב, כ, ל, מ, ש) if word is >= 4 chars
                if (bare.length >= 4 && /^[הובכלמש]/.test(bare)) {
                    const stem = bare.slice(1);
                    if (stem.length >= 3 && !HEBREW_STOP_WORDS.has(stem) && !tokens.includes(stem)) {
                        tokens.push(stem);
                    }
                }
            }
            return tokens.length > 0 ? tokens : rawWords;
        }

        // Retrieve top-ranked paragraphs across the selected scope (All 24 books / Current book / Current chapter)
        async function retrieveRelevantPassages(question, scope) {
            await ensureAllBooksLoaded();
            const tokens = extractQueryTokens(question);
            const normalizedQ = stripNikkud(question.toLowerCase()).replace(/[?.,!]/g, '').trim();

            // Check if question asks to summarize the current chapter
            const isSummaryRequest = /סכם|סיכום|נקודות מרכזיות|עיקרי הדברים/.test(normalizedQ);

            // 1. Glossary matches
            const glossaryHits = MANITOU_GLOSSARY.filter(g => {
                const termLower = g.term.toLowerCase();
                return normalizedQ.includes(termLower) || tokens.some(t => t.length >= 3 && termLower.includes(t));
            }).slice(0, 2);

            // 2. Determine candidate books
            let targetBooks = books;
            if ((scope === 'book' || scope === 'chapter') && activeBook) {
                targetBooks = [activeBook];
            }

            const scoredPassages = [];

            for (const b of targetBooks) {
                const chaps = chapterCache[b.id] || [];
                for (const c of chaps) {
                    if (scope === 'chapter' && activeChapter && Number(c.id) !== Number(activeChapter.id)) {
                        continue;
                    }
                    const chapTitleClean = formatChapterDisplayTitle(c.title, b);
                    const chapTitleLower = stripNikkud((c.title || '').toLowerCase());
                    const paras = c._paragraphs || [];

                    // If user asked for a chapter summary in 'chapter' scope, pick representative paragraphs across the chapter
                    if (isSummaryRequest && scope === 'chapter' && paras.length > 0) {
                        const step = Math.max(1, Math.floor(paras.length / 6));
                        for (let idx = 0; idx < paras.length && scoredPassages.length < 7; idx += step) {
                            scoredPassages.push({
                                book: b,
                                chapter: c,
                                chapTitle: chapTitleClean,
                                pNum: paras[idx].pNum,
                                text: paras[idx].text,
                                score: 50 - idx
                            });
                        }
                        continue;
                    }

                    let titleBonus = 0;
                    for (const tk of tokens) {
                        if (chapTitleLower.includes(tk)) titleBonus += 6;
                    }

                    for (const p of paras) {
                        let score = titleBonus;
                        let matchedTokensCount = 0;

                        if (normalizedQ.length >= 5 && p.lower.includes(normalizedQ)) {
                            score += 35;
                        }

                        for (const tk of tokens) {
                            const pos = p.lower.indexOf(tk);
                            if (pos !== -1) {
                                matchedTokensCount += 1;
                                score += (tk.length >= 4 ? 7 : 4);
                                // Bonus for multiple occurrences in the same paragraph
                                const secondPos = p.lower.indexOf(tk, pos + tk.length);
                                if (secondPos !== -1) score += 2.5;
                            }
                        }

                        // Synergy bonus when multiple distinct query words appear together in the same paragraph
                        if (matchedTokensCount >= 2) {
                            score += matchedTokensCount * 6;
                        }
                        // Slight preference for well-sized explanatory paragraphs (80-650 chars)
                        if (score > 0 && p.text.length >= 90 && p.text.length <= 750) {
                            score += 2;
                        }

                        if (score > titleBonus && score >= 6) {
                            scoredPassages.push({
                                book: b,
                                chapter: c,
                                chapTitle: chapTitleClean,
                                pNum: p.pNum,
                                text: p.text,
                                score
                            });
                        }
                    }
                }
            }

            scoredPassages.sort((a, b) => b.score - a.score);

            // Diversify results so one single chapter doesn't monopolize all cards (max 2 per chapter when searching all site)
            const topPassages = [];
            const perChapterCount = {};
            for (const item of scoredPassages) {
                const key = `${item.book.id}_${item.chapter.id}`;
                const limit = scope === 'chapter' ? 6 : 2;
                if ((perChapterCount[key] || 0) >= limit) continue;
                perChapterCount[key] = (perChapterCount[key] || 0) + 1;
                topPassages.push(item);
                if (topPassages.length >= 6) break;
            }

            return { topPassages, glossaryHits, tokens };
        }

        function highlightTokensInSnippet(text, tokens) {
            if (!text) return '';
            let snippet = text.length > 440 ? text.slice(0, 440) + '...' : text;
            const validTokens = (tokens || []).filter(t => t.length >= 3).slice(0, 5);
            if (validTokens.length === 0) return snippet;
            const pattern = validTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            try {
                const re = new RegExp(`(${pattern})`, 'gi');
                return snippet.replace(re, '<mark>$1</mark>');
            } catch (e) {
                return snippet;
            }
        }

        // Synthesize a coherent local answer in Hebrew from the top passages + glossary when no external API key is set
        function buildLocalSynthesizedAnswer(question, topPassages, glossaryHits, scope) {
            let html = '';

            if (glossaryHits.length > 0) {
                glossaryHits.forEach(g => {
                    html += `
                        <div class="ai-glossary-match-box">
                            <div style="font-weight: 800; color: var(--accent); margin-bottom: 3px;">📖 הגדרה במילון משנת מניטו: ${g.term} (${g.catName})</div>
                            <div><strong>${g.shortDef}</strong> — ${g.fullDesc}</div>
                        </div>
                    `;
                });
            }

            if (topPassages.length === 0) {
                html += `
                    <div class="ai-answer-summary" style="border-bottom: none; margin-bottom: 0;">
                        <h4>לא נמצאו פסקאות מדויקות לשאלה זו בטווח שנבחר</h4>
                        <p style="margin: 0.3rem 0;">נסה לנסח את השאלה במילים אחרות, או ודא שטווח החיפוש למעלה מוגדר על <strong>"🌐 כל האתר והספרייה (24 ספרים)"</strong>.</p>
                    </div>
                `;
                return html;
            }

            const uniqueBooks = [...new Set(topPassages.map(p => p.book.title))];
            const scopeDesc = scope === 'chapter'
                ? `מתוך הפרק הנוכחי`
                : (scope === 'book' ? `מתוך הספר "${activeBook?.title || ''}"` : `מתוך כלל ספריית מניטו (נמצאו הקבלות ב-${uniqueBooks.slice(0, 4).join(', ')})`);

            // Extract key sentences from the top 2 passages to form an immediate executive summary
            const bestPassage = topPassages[0];
            const sentences = bestPassage.text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 25);
            const summaryExcerpt = sentences.slice(0, 3).join(' ') || bestPassage.text.slice(0, 280);

            html += `
                <div class="ai-answer-summary">
                    <div class="ai-answer-header-row">
                        <h4>✨ תמצית הדברים במשנת הרב אשכנזי (מניטו) ${scopeDesc}</h4>
                        <button type="button" class="ai-copy-answer-btn" title="העתק תשובה ומקורות ללוח">📋 העתק תשובה</button>
                    </div>
                    <div class="ai-answer-body">
                        <p>
                            בכתבי מניטו הנושא מבואר בראש ובראשונה בספר <strong>"${bestPassage.book.title}"</strong> (${bestPassage.chapTitle}, פסקה §${bestPassage.pNum}):
                        </p>
                        <p style="font-family: var(--font-serif); font-size: 1.08em; padding: 0.65rem 1rem; background: var(--secondary-bg); border-right: 3px solid var(--accent); border-radius: 8px;">
                            "${summaryExcerpt.length > 360 ? summaryExcerpt.slice(0, 360) + '...' : summaryExcerpt}"
                        </p>
                    </div>
                </div>
            `;

            return html;
        }

        // Optional: Call Google Gemini API with retrieved RAG context for generative synthesis
        async function generateGeminiAnswer(apiKey, question, topPassages, glossaryHits) {
            const contextBlocks = topPassages.map((p, i) =>
                `[מקור ${i + 1}: ספר "${p.book.title}", פרק "${p.chapTitle}", פסקה §${p.pNum}]\n${p.text}`
            ).join('\n\n');

            const glossaryContext = glossaryHits.map(g =>
                `[מושג יסוד: ${g.term}] ${g.shortDef} - ${g.fullDesc}`
            ).join('\n');

            const systemPrompt = `אתה "החברותא של מניטו", עוזר מחקר ולימוד תורני-פילוסופי המומחה בכתבי הרב יהודא לאון אשכנזי (מניטו) זצ"ל.
ענה בעברית בהירה, עשירה ומדויקת על שאלת המשתמש אך ורק על סמך המקורות המצורפים מתוך ספריית מניטו.
ציין בתשובתך על אילו ספרים ופרקים אתה מתבסס (למשל: בספר "מספד למשיח", פסקה §4). אל תמציא מקורות שאינם מופיעים בהקשר.`;

            const userPayload = `שאלת הלומד: ${question}\n\n${glossaryContext ? 'מושגי יסוד רלוונטיים:\n' + glossaryContext + '\n\n' : ''}מקורות שנשלפו מתוך ספריית מניטו:\n${contextBlocks}`;

            // Try local server proxy first (supports both AIza... keys and AQ... tokens cleanly)
            try {
                const proxyResp = await fetch('/api/ai-ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: apiKey, systemPrompt, userPayload })
                });
                if (proxyResp.ok) {
                    const proxyData = await proxyResp.json();
                    if (proxyData && proxyData.text) {
                        return proxyData.text.trim();
                    }
                }
            } catch (e) {
                // Fallback to direct client call below
            }

            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: userPayload }] }],
                    generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
                })
            });

            if (!resp.ok) {
                throw new Error(`Gemini API HTTP ${resp.status}`);
            }
            const data = await resp.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return rawText.trim();
        }

        function formatSimpleMarkdown(mdText) {
            const escaped = mdText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
            const blocks = escaped.split(/\n\n+/);
            return blocks.map(block => {
                const lines = block.trim().split('\n');
                if (lines.every(l => /^[-•*]\s+/.test(l.trim()))) {
                    const items = lines.map(l => `<li>${l.trim().replace(/^[-•*]\s+/, '')}</li>`).join('');
                    return `<ul>${items}</ul>`;
                }
                return `<p>${lines.join('<br>')}</p>`;
            }).join('');
        }

        async function handleUserQuestion(question) {
            if (isBusy) return;
            isBusy = true;
            if (aiChatSendBtn) aiChatSendBtn.disabled = true;

            // 1. Append User Bubble
            const userMsgEl = document.createElement('div');
            userMsgEl.className = 'ai-msg ai-msg-user';
            userMsgEl.innerHTML = `
                <div class="ai-msg-avatar">א״מ</div>
                <div class="ai-msg-bubble">${question.replace(/</g, '&lt;')}</div>
            `;
            aiChatMessages.appendChild(userMsgEl);

            // 2. Append Loading Assistant Bubble
            const assistantMsgEl = document.createElement('div');
            assistantMsgEl.className = 'ai-msg ai-msg-assistant';
            assistantMsgEl.innerHTML = `
                <div class="ai-msg-avatar">✨</div>
                <div class="ai-msg-bubble">
                    <div class="ai-loading-box">
                        <div class="ai-loading-title">
                            <span>⏳ סורק את כל 24 הספרים ו-271 הפרקים ומנסח תשובה מבוססת מקורות...</span>
                        </div>
                        <div class="ai-loading-bar" style="width: 88%;"></div>
                        <div class="ai-loading-bar" style="width: 64%;"></div>
                    </div>
                </div>
            `;
            aiChatMessages.appendChild(assistantMsgEl);
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

            try {
                const { topPassages, glossaryHits, tokens } = await retrieveRelevantPassages(question, currentScope);
                const apiKey = (localStorage.getItem('manitou_gemini_api_key') || '').trim();

                let summaryHtml = '';
                if ((apiKey || hasServerAiKey) && topPassages.length > 0) {
                    try {
                        const geminiText = await generateGeminiAnswer(apiKey, question, topPassages, glossaryHits);
                        if (geminiText) {
                            summaryHtml = `
                                <div class="ai-answer-summary">
                                    <div class="ai-answer-header-row">
                                        <h4>✨ תשובת החברותא (Gemini AI על בסיס כתבי מניטו)</h4>
                                        <button type="button" class="ai-copy-answer-btn" title="העתק תשובה ומקורות ללוח">📋 העתק תשובה</button>
                                    </div>
                                    <div class="ai-answer-body">${formatSimpleMarkdown(geminiText)}</div>
                                </div>
                            `;
                        }
                    } catch (apiErr) {
                        console.warn('Gemini API fallback to local synthesis:', apiErr);
                    }
                }

                if (!summaryHtml) {
                    summaryHtml = buildLocalSynthesizedAnswer(question, topPassages, glossaryHits, currentScope);
                }

                // Build clickable source cards with direct paragraph deep-links
                let sourcesHtml = '';
                if (topPassages.length > 0) {
                    const cards = topPassages.map((item, idx) => `
                        <div class="ai-source-card">
                            <div class="ai-source-header">
                                <div class="ai-source-location">
                                    <span class="ai-source-num-badge">${idx + 1}</span>
                                    <span>📚 ${item.book.title}</span>
                                    <span>•</span>
                                    <span>${item.chapTitle}</span>
                                    <span class="ai-source-para-pill">פסקה §${item.pNum}</span>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                    <button type="button" class="ai-source-split-btn" data-book-id="${item.book.id}" data-chap-id="${item.chapter.id}" data-p-num="${item.pNum}" title="פתח מקור זה בחלון חברותא לצד הפרק הנוכחי">
                                        ◫ פתח בחברותא
                                    </button>
                                    <button type="button" class="ai-source-jump-btn" data-book-id="${item.book.id}" data-chap-id="${item.chapter.id}" data-p-num="${item.pNum}">
                                        פתח בפסקה §${item.pNum} ↗
                                    </button>
                                </div>
                            </div>
                            <p class="ai-source-excerpt">"${highlightTokensInSnippet(item.text, tokens)}"</p>
                        </div>
                    `).join('');
                    sourcesHtml = `
                        <div class="ai-sources-section-title">
                            <span>📚 מראי מקומות מדויקים מתוך הספרייה (${topPassages.length} מקורות):</span>
                            <span>לחץ לפתיחת הפסקה בספר</span>
                        </div>
                        <div class="ai-sources-grid">${cards}</div>
                    `;
                }

                const bubbleEl = assistantMsgEl.querySelector('.ai-msg-bubble');
                if (bubbleEl) {
                    bubbleEl.innerHTML = `${summaryHtml}${sourcesHtml}`;
                    bubbleEl.querySelectorAll('.ai-source-jump-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const bId = btn.dataset.bookId;
                            const cId = btn.dataset.chapId;
                            const pNum = btn.dataset.pNum;
                            window.closeAiAssistant();
                            window.pendingParagraphScroll = pNum;
                            window.location.hash = `#/reader/${bId}/chapter/${cId}?p=${pNum}`;
                        });
                    });
                    bubbleEl.querySelectorAll('.ai-source-split-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const bId = btn.dataset.bookId;
                            const cId = btn.dataset.chapId;
                            const pNum = btn.dataset.pNum;
                            window.closeAiAssistant();
                            const isReaderVisible = readerMode && readerMode.style.display !== 'none';
                            if (isReaderVisible && typeof window.openSplitChapterPane === 'function') {
                                window.openSplitChapterPane(bId, cId, pNum);
                            } else {
                                window.pendingParagraphScroll = pNum;
                                window.location.hash = `#/reader/${bId}/chapter/${cId}?p=${pNum}`;
                            }
                        });
                    });
                    const copyBtn = bubbleEl.querySelector('.ai-copy-answer-btn');
                    if (copyBtn) {
                        copyBtn.addEventListener('click', async () => {
                            const plainText = bubbleEl.innerText.replace(/📋 העתק תשובה/g, '').trim();
                            try {
                                await navigator.clipboard.writeText(plainText);
                                showToast('📋 התשובה ומראי המקומות הועתקו ללוח!');
                            } catch (e) {}
                        });
                    }
                }
            } catch (err) {
                console.error('AI Assistant error:', err);
                const bubbleEl = assistantMsgEl.querySelector('.ai-msg-bubble');
                if (bubbleEl) {
                    bubbleEl.innerHTML = `<div style="color: #f87171;">אירעה שגיאה בעת סריקת המקורות. נסה שוב.</div>`;
                }
            } finally {
                isBusy = false;
                if (aiChatSendBtn) aiChatSendBtn.disabled = false;
                aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
            }
        }
    }

    // --- Inline Homepage Transcripts & Full Archive Section (Below Books) ---
    function setupTranscriptsCenter() {
        const transcriptsSection = document.getElementById('transcriptsSection');
        const transcriptsInlinePanel = document.getElementById('transcriptsInlinePanel');
        const toggleExpandBtn = document.getElementById('toggleTranscriptsExpandBtn');
        const toggleExpandText = document.getElementById('toggleTranscriptsExpandText');
        const navTranscriptsBtn = document.getElementById('navTranscriptsBtn');
        const syncTranscriptsLiveBtn = document.getElementById('syncTranscriptsLiveBtn');
        const syncTranscriptsLiveText = document.getElementById('syncTranscriptsLiveText');
        const downloadAllMdBtn = document.getElementById('downloadAllTranscriptsMdBtn');
        const downloadAllHtmlBtn = document.getElementById('downloadAllTranscriptsHtmlBtn');
        const downloadAllJsonBtn = document.getElementById('downloadAllTranscriptsJsonBtn');
        const sourcePills = document.querySelectorAll('#transcriptsSourcePills .tr-source-pill');
        const searchInputEl = document.getElementById('transcriptsSearchInput');
        const clearSearchBtn = document.getElementById('clearTranscriptsSearchBtn');
        const catSelectEl = document.getElementById('transcriptsCategorySelect');
        const listContainer = document.getElementById('transcriptsListContainer');
        const previewPane = document.getElementById('transcriptPreviewPane');
        const trPreviewKicker = document.getElementById('trPreviewKicker');
        const trPreviewTitle = document.getElementById('trPreviewTitle');
        const trPreviewBody = document.getElementById('trPreviewBody');
        const trPreviewDownloadBtn = document.getElementById('trPreviewDownloadBtn');
        const trPreviewWideBtn = document.getElementById('trPreviewWideBtn');
        const trPreviewCopyBtn = document.getElementById('trPreviewCopyBtn');
        const trPreviewOrigLink = document.getElementById('trPreviewOrigLink');
        const closeTranscriptPreviewBtn = document.getElementById('closeTranscriptPreviewBtn');
        const transcriptsWorkspaceEl = document.getElementById('transcriptsWorkspace');

        if (!transcriptsSection || !listContainer) return;

        let activeSourceFilter = 'fulltext'; // 'fulltext' | 'external' | 'library.manitou.org.il' | 'manitou.org.il' | 'books' | 'all'
        let activeCategoryFilter = 'all';
        let externalRecords = [];
        let bookRecords = [];
        let combinedRecords = [];
        let currentlyFilteredRecords = [];
        let activePreviewRecord = null;
        let isLoadedOnce = false;
        let booksAppendedToTranscripts = false;
        let visibleTranscriptsLimit = 80;

        if (toggleExpandBtn && transcriptsInlinePanel) {
            toggleExpandBtn.addEventListener('click', () => {
                const expanded = transcriptsInlinePanel.classList.toggle('is-expanded');
                if (toggleExpandText) {
                    toggleExpandText.textContent = expanded ? 'כווץ חלון' : 'הרחב חלון';
                }
            });
        }

        function downloadBlobFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        async function ensureBookTranscriptRecordsBuilt() {
            if (booksAppendedToTranscripts) return;
            await ensureAllBooksLoaded();
            bookRecords = [];
            books.forEach(b => {
                const chaps = chapterCache[b.id] || [];
                chaps.forEach(c => {
                    const cleanTitle = formatChapterDisplayTitle(c.title, b);
                    const plain = (c._plainText || '').trim();
                    const wc = c.wordCount || (plain ? plain.split(/\s+/).length : 0);
                    bookRecords.push({
                        id: `book_${b.id}_chap_${c.id}`,
                        sourceGroup: 'books',
                        sourceSite: 'manitou.org.il (ספרים מקוונים)',
                        sourceUrl: b.link || 'https://manitou.org.il/arcive/sfarim',
                        bookId: b.id,
                        chapterId: c.id,
                        title: `${b.title} — ${cleanTitle}`,
                        category: b.series || b.categoryLabel || 'ספרים מקוונים',
                        wordCount: wc,
                        readingMinutes: c.readingMinutes || Math.max(1, Math.round(wc / 150)),
                        pdfUrl: c.local_pdf || c.pdf_url || '',
                        audioUrl: c.audio_url || '',
                        html: c.text || '',
                        plainText: plain,
                        _lowerTitle: stripNikkud(`${b.title} ${cleanTitle}`.toLowerCase()),
                        _lowerCategory: stripNikkud((b.series || b.categoryLabel || '').toLowerCase()),
                        _lowerText: c._lowerText || stripNikkud(plain.toLowerCase())
                    });
                });
            });
            combinedRecords = [...externalRecords, ...bookRecords];
            booksAppendedToTranscripts = true;
            updatePillCounts();
        }

        function isRecordFullText(rec) {
            if (rec.sourceGroup === 'books') return (rec.wordCount || 0) >= 60;
            if (typeof rec.hasFullText === 'boolean') return rec.hasFullText;
            return ((rec.plainText || '').trim().length >= 350);
        }

        function updatePillCounts() {
            const countFullTextEl = document.getElementById('trCountFullText');
            const countExtEl = document.getElementById('trCountExternal');
            const countAllEl = document.getElementById('trCountAll');
            const countLibEl = document.getElementById('trCountLibrary');
            const countManEl = document.getElementById('trCountManitouOrg');
            const countBooksEl = document.getElementById('trCountBooks');

            const fullTextCount = externalRecords.filter(r => isRecordFullText(r)).length;
            const libCount = externalRecords.filter(r => r.sourceGroup === 'library.manitou.org.il').length;
            const manCount = externalRecords.filter(r => r.sourceGroup === 'manitou.org.il').length;
            const bCount = booksAppendedToTranscripts ? bookRecords.length : 271;

            if (countFullTextEl) countFullTextEl.textContent = fullTextCount;
            if (countExtEl) countExtEl.textContent = externalRecords.length;
            if (countLibEl) countLibEl.textContent = libCount;
            if (countManEl) countManEl.textContent = manCount;
            if (countBooksEl) countBooksEl.textContent = bCount;
            if (countAllEl) countAllEl.textContent = externalRecords.length + bCount;
        }

        async function loadAllTranscriptRecords(forceReload = false) {
            if (isLoadedOnce && !forceReload) return;
            listContainer.innerHTML = `<div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">⏳ טוען את ארכיון התמלולים מ-library.manitou.org.il ומ-manitou.org.il...</div>`;

            const loadedItems = await ensureTranscriptsArchiveLoaded(forceReload);
            externalRecords = loadedItems.slice();
            combinedRecords = booksAppendedToTranscripts ? [...externalRecords, ...bookRecords] : [...externalRecords];
            isLoadedOnce = true;

            updatePillCounts();
            populateCategoryFilter();
            renderTranscriptsList();
        }

        function matchesSourceGroup(rec, filterVal) {
            if (filterVal === 'all') return true;
            if (filterVal === 'fulltext') return rec.sourceGroup !== 'books' && isRecordFullText(rec);
            if (filterVal === 'external') return rec.sourceGroup !== 'books';
            return rec.sourceGroup === filterVal;
        }

        function populateCategoryFilter() {
            if (!catSelectEl) return;
            const cats = new Map();
            combinedRecords.forEach(r => {
                if (!matchesSourceGroup(r, activeSourceFilter)) return;
                const c = (r.category || 'כללי').trim();
                cats.set(c, (cats.get(c) || 0) + 1);
            });
            catSelectEl.innerHTML = `<option value="all">כל הקטגוריות והסדרות (${cats.size})</option>`;
            Array.from(cats.entries())
                .sort((a, b) => b[1] - a[1])
                .forEach(([catName, count]) => {
                    const opt = document.createElement('option');
                    opt.value = catName;
                    opt.textContent = `${catName} (${count})`;
                    catSelectEl.appendChild(opt);
                });
            catSelectEl.value = 'all';
            activeCategoryFilter = 'all';
        }

        function renderTranscriptsList() {
            const rawVal = (searchInputEl?.value || '').trim();
            if (clearSearchBtn) clearSearchBtn.style.display = rawVal ? 'inline-flex' : 'none';
            const query = stripNikkud(rawVal.toLowerCase());

            currentlyFilteredRecords = combinedRecords.filter(rec => {
                if (!matchesSourceGroup(rec, activeSourceFilter)) return false;
                if (activeCategoryFilter !== 'all' && rec.category !== activeCategoryFilter) return false;
                if (!query) return true;
                const titleClean = rec._lowerTitle || stripNikkud((rec.title || '').toLowerCase());
                const catClean = rec._lowerCategory || stripNikkud((rec.category || '').toLowerCase());
                const bodyClean = rec._lowerText || stripNikkud((rec.plainText || '').toLowerCase());
                return titleClean.includes(query) || catClean.includes(query) || bodyClean.includes(query);
            });

            if (currentlyFilteredRecords.length === 0) {
                listContainer.innerHTML = `
                    <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                        <p style="font-size: 1.08rem; margin-bottom: 0.8rem;">לא נמצאו תמלולים התואמים לסינון הנוכחי.</p>
                        ${rawVal ? `<button type="button" class="transcripts-action-btn" id="resetTrEmptyFilterBtn">✕ נקה סינון חיפוש</button>` : `<button type="button" class="transcripts-action-btn sync-btn" onclick="document.getElementById('syncTranscriptsLiveBtn').click()">🔄 סנכרן תמלולים מהאתר המקורי</button>`}
                    </div>
                `;
                const resetBtn = document.getElementById('resetTrEmptyFilterBtn');
                if (resetBtn && searchInputEl) {
                    resetBtn.addEventListener('click', () => {
                        searchInputEl.value = '';
                        renderTranscriptsList();
                    });
                }
                return;
            }

            const sliceToRender = currentlyFilteredRecords.slice(0, visibleTranscriptsLimit);
            const cardsHtml = sliceToRender.map((rec, idx) => {
                const badgeClass = rec.sourceGroup === 'library.manitou.org.il'
                    ? 'source-lib'
                    : (rec.sourceGroup === 'manitou.org.il' ? 'source-man' : 'source-book');
                const badgeLabel = rec.sourceGroup === 'library.manitou.org.il'
                    ? '🏛️ library.manitou.org.il'
                    : (rec.sourceGroup === 'manitou.org.il' ? '📜 manitou.org.il/arcive' : '📚 ספרים מקוונים');
                const excerpt = (rec.plainText || '').slice(0, 175).trim();

                return `
                    <div class="transcript-item-card" data-rec-idx="${idx}">
                        <div class="transcript-item-top">
                            <div class="transcript-item-badges">
                                <span class="transcript-source-badge ${badgeClass}">${badgeLabel}</span>
                                <span class="transcript-cat-badge">${rec.category || 'כללי'}</span>
                                <span class="transcript-meta-badge">⏱️ ${rec.readingMinutes || 1} דק׳ • ${(rec.wordCount || 0).toLocaleString()} מילים</span>
                            </div>
                            <div class="transcript-item-actions">
                                <button type="button" class="tr-card-btn read-btn" data-action="preview" data-idx="${idx}" title="קרא תמלול מלא בחלונית הקריאה">📖 קרא תמלול</button>
                                ${rec.bookId && rec.chapterId ? `
                                    <button type="button" class="tr-card-btn" data-action="open-reader" data-idx="${idx}" title="פתח בקורא הספרים המלא">📚 פתח בקורא</button>
                                ` : ''}
                                <button type="button" class="tr-card-btn" data-action="dl-single" data-idx="${idx}" title="הורד תמלול כקובץ Markdown / טקסט">⬇ הורד (.md)</button>
                                ${rec.pdfUrl ? `
                                    <a href="${rec.pdfUrl}" target="_blank" rel="noopener" class="tr-card-btn pdf-btn" title="הורד קובץ PDF מקורי">📄 PDF</a>
                                ` : ''}
                                <a href="${rec.sourceUrl}" target="_blank" rel="noopener" class="tr-card-btn" title="פתח עמוד מקורי באתר מניטו">↗</a>
                            </div>
                        </div>
                        <h4 class="transcript-item-title">${rec.title}</h4>
                        ${excerpt ? `<p class="transcript-item-excerpt">${excerpt}...</p>` : ''}
                    </div>
                `;
            }).join('');

            const hasMore = currentlyFilteredRecords.length > visibleTranscriptsLimit;
            const loadMoreHtml = hasMore ? `
                <div style="text-align: center; margin-top: 1.25rem;">
                    <button type="button" id="loadMoreTranscriptsBtn" class="transcripts-action-btn primary-dl-btn" style="padding: 0.65rem 1.6rem; font-size: 0.92rem;">
                        הצג עוד תמלולים (${sliceToRender.length} מתוך ${currentlyFilteredRecords.length}) ↓
                    </button>
                </div>
            ` : '';

            listContainer.innerHTML = `
                <div class="transcripts-list-summary">
                    <span>נמצאו <strong>${currentlyFilteredRecords.length.toLocaleString()}</strong> פריטים במאגר (מוצגים ${sliceToRender.length})</span>
                    <span>לחיצה על כפתורי ההורדה למעלה תוריד את כל <strong>${currentlyFilteredRecords.length.toLocaleString()}</strong> הפריטים המסוננים</span>
                </div>
                <div class="transcripts-cards-list">${cardsHtml}</div>
                ${loadMoreHtml}
            `;

            const loadMoreBtn = document.getElementById('loadMoreTranscriptsBtn');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', () => {
                    visibleTranscriptsLimit += 100;
                    renderTranscriptsList();
                });
            }

            listContainer.querySelectorAll('.transcript-item-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('button, a')) return;
                    const idx = Number(card.dataset.recIdx);
                    const rec = currentlyFilteredRecords[idx];
                    if (rec) openTranscriptPreview(rec, searchInputEl?.value || '');
                });
            });

            listContainer.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = Number(btn.dataset.idx);
                    const rec = currentlyFilteredRecords[idx];
                    if (!rec) return;
                    const action = btn.dataset.action;
                    if (action === 'preview') {
                        openTranscriptPreview(rec, searchInputEl?.value || '');
                    } else if (action === 'open-reader' && rec.bookId && rec.chapterId) {
                        window.location.hash = `#/reader/${rec.bookId}/chapter/${rec.chapterId}`;
                    } else if (action === 'dl-single') {
                        downloadSingleTranscript(rec);
                    }
                });
            });
        }

        function downloadSingleTranscript(rec) {
            const safeName = (rec.title || 'manitou-transcript').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
            const md = `# ${rec.title}\n\n- **מקור:** ${rec.sourceSite}\n- **קטגוריה:** ${rec.category || 'כללי'}\n- **קישור מקורי:** ${rec.sourceUrl}\n${rec.pdfUrl ? `- **קובץ PDF:** ${rec.pdfUrl}\n` : ''}\n---\n\n${rec.plainText || ''}\n`;
            downloadBlobFile(md, `${safeName}.md`, 'text/markdown;charset=utf-8');
            showToast(`📥 התמלול "${rec.title}" הורד בהצלחה!`);
        }

        function openTranscriptPreview(rec, highlightQuery = '') {
            activePreviewRecord = rec;
            if (!previewPane) return;
            previewPane.style.display = 'flex';
            if (window.innerWidth <= 960) {
                setTimeout(() => previewPane.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
            }
            if (trPreviewKicker) trPreviewKicker.textContent = `${rec.sourceSite} • ${rec.category || ''}`;
            if (trPreviewTitle) trPreviewTitle.textContent = rec.title;
            if (trPreviewOrigLink) trPreviewOrigLink.href = rec.sourceUrl || '#';
            if (trPreviewBody) {
                if (rec.html && rec.html.length > 40) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = rec.html;
                    tmp.querySelectorAll('.mn-toc, .koowa_header, [id^="komento"], [class*="komento"], script, style').forEach(el => el.remove());
                    trPreviewBody.innerHTML = tmp.innerHTML;
                } else {
                    const safeEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const paras = (rec.plainText || '').split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean);
                    const pdfNote = rec.pdfUrl ? `<div class="extracted-pdf-banner" style="margin-bottom:1rem;padding:0.65rem 1rem;border-radius:10px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);font-size:0.9rem;">📖 <strong>טקסט חופשי מלא</strong> (${(rec.wordCount || 0).toLocaleString()} מילים) • <a href="${rec.pdfUrl}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:700;">לפתיחת קובץ ה-PDF המקורי ↗</a></div>` : '';
                    trPreviewBody.innerHTML = pdfNote + paras.map(p => (p.length < 75 && !/[.,;]$/.test(p)) ? `<h3>${safeEsc(p)}</h3>` : `<p>${safeEsc(p)}</p>`).join('');
                }
                trPreviewBody.scrollTop = 0;

                const cleanHq = (highlightQuery || '').trim();
                if (cleanHq.length >= 2) {
                    const words = cleanHq.replace(/^"|"$/g, '').split(/\s+/).filter(Boolean);
                    let firstMark = null;
                    const walker = document.createTreeWalker(trPreviewBody, NodeFilter.SHOW_TEXT, null, false);
                    const tNodes = [];
                    let n;
                    while ((n = walker.nextNode())) tNodes.push(n);
                    tNodes.forEach(tNode => {
                        let txt = tNode.textContent;
                        let matched = false;
                        words.forEach(w => {
                            try {
                                const rx = makeHebrewNikkudRegex(w, false);
                                if (rx.test(txt)) matched = true;
                            } catch (e) {}
                        });
                        if (!matched) return;
                        let htmlStr = txt;
                        words.forEach(w => {
                            try {
                                const rx = makeHebrewNikkudRegex(w, false);
                                htmlStr = htmlStr.replace(rx, '%%TRMARK%%$1%%ENDTRMARK%%');
                            } catch (e) {}
                        });
                        const spanWrap = document.createElement('span');
                        spanWrap.innerHTML = htmlStr
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/%%TRMARK%%/g, '<mark class="search-highlight" style="background: rgba(212,175,55,0.42); color: var(--text-main); padding: 1px 4px; border-radius: 3px; font-weight: 700;">')
                            .replace(/%%ENDTRMARK%%/g, '</mark>');
                        if (tNode.parentNode) {
                            tNode.parentNode.replaceChild(spanWrap, tNode);
                            if (!firstMark) firstMark = spanWrap.querySelector('mark');
                        }
                    });
                    if (firstMark) {
                        setTimeout(() => firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
                    }
                }
            }
        }

        if (closeTranscriptPreviewBtn && previewPane) {
            closeTranscriptPreviewBtn.addEventListener('click', () => {
                previewPane.style.display = 'none';
                if (transcriptsWorkspaceEl) transcriptsWorkspaceEl.classList.remove('preview-wide-mode');
                if (trPreviewWideBtn) trPreviewWideBtn.textContent = '⤢ קריאה רחבה';
            });
        }
        if (trPreviewWideBtn && transcriptsWorkspaceEl) {
            trPreviewWideBtn.addEventListener('click', () => {
                const isWide = transcriptsWorkspaceEl.classList.toggle('preview-wide-mode');
                trPreviewWideBtn.textContent = isWide ? '⤡ הצג רשימה' : '⤢ קריאה רחבה';
                if (isWide && transcriptsInlinePanel && !transcriptsInlinePanel.classList.contains('is-expanded')) {
                    transcriptsInlinePanel.classList.add('is-expanded');
                    if (toggleExpandText) toggleExpandText.textContent = 'כווץ חלון';
                }
            });
        }
        if (trPreviewDownloadBtn) {
            trPreviewDownloadBtn.addEventListener('click', () => {
                if (activePreviewRecord) downloadSingleTranscript(activePreviewRecord);
            });
        }
        if (trPreviewCopyBtn) {
            trPreviewCopyBtn.addEventListener('click', async () => {
                if (!activePreviewRecord) return;
                try {
                    await navigator.clipboard.writeText(`${activePreviewRecord.title}\n\n${activePreviewRecord.plainText || ''}`);
                    showToast('📋 טקסט התמלול הועתק ללוח!');
                } catch (e) {}
            });
        }

        sourcePills.forEach(pill => {
            pill.addEventListener('click', async () => {
                sourcePills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeSourceFilter = pill.dataset.source || 'external';
                visibleTranscriptsLimit = 80;
                if ((activeSourceFilter === 'books' || activeSourceFilter === 'all') && !booksAppendedToTranscripts) {
                    listContainer.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">⏳ טוען את פרקי 24 הספרים לתצוגה מאוחדת...</div>`;
                    await ensureBookTranscriptRecordsBuilt();
                }
                populateCategoryFilter();
                renderTranscriptsList();
            });
        });

        if (catSelectEl) {
            catSelectEl.addEventListener('change', () => {
                activeCategoryFilter = catSelectEl.value;
                visibleTranscriptsLimit = 80;
                renderTranscriptsList();
            });
        }

        if (searchInputEl) {
            searchInputEl.addEventListener('input', () => {
                visibleTranscriptsLimit = 80;
                renderTranscriptsList();
            });
        }

        if (clearSearchBtn && searchInputEl) {
            clearSearchBtn.addEventListener('click', () => {
                searchInputEl.value = '';
                visibleTranscriptsLimit = 80;
                renderTranscriptsList();
            });
        }

        // Bulk Downloads (.md, .html, .json)
        if (downloadAllMdBtn) {
            downloadAllMdBtn.addEventListener('click', () => {
                const targetList = currentlyFilteredRecords.length > 0 ? currentlyFilteredRecords : combinedRecords;
                if (targetList.length === 0) return;
                let md = `# ארכיון תמלולי השיעורים והספרים — מכון מניטו (הרב יהודא לאון אשכנזי זצ"ל)\n`;
                md += `> הופק מתוך ארכיון האתר (${targetList.length} תמלולים ופרקים מתוך library.manitou.org.il ו-manitou.org.il)\n\n---\n\n`;
                targetList.forEach((rec, i) => {
                    md += `## ${i + 1}. ${rec.title}\n`;
                    md += `- **מקור:** ${rec.sourceSite} | **קטגוריה:** ${rec.category || 'כללי'} | **מילים:** ${rec.wordCount || 0}\n`;
                    md += `- **קישור:** ${rec.sourceUrl}\n\n`;
                    md += `${rec.plainText || ''}\n\n---\n\n`;
                });
                downloadBlobFile(md, `manitou-all-transcripts-${targetList.length}.md`, 'text/markdown;charset=utf-8');
                showToast(`📦 הורדו ${targetList.length} תמלולים בקובץ Markdown מאוחד!`);
            });
        }

        if (downloadAllHtmlBtn) {
            downloadAllHtmlBtn.addEventListener('click', () => {
                const targetList = currentlyFilteredRecords.length > 0 ? currentlyFilteredRecords : combinedRecords;
                if (targetList.length === 0) return;
                const tocItems = targetList.map((r, i) => `<li><a href="#tr-${i + 1}">${r.title}</a> <small>(${r.sourceSite} • ${r.category || ''})</small></li>`).join('');
                const articlesHtml = targetList.map((r, i) => `
                    <article id="tr-${i + 1}" style="margin: 2.5rem 0; padding-bottom: 2rem; border-bottom: 2px solid #e2e8f0;">
                        <div style="color: #b8860b; font-size: 0.9rem; font-weight: bold;">${i + 1}. ${r.sourceSite} • ${r.category || ''}</div>
                        <h2 style="margin: 0.4rem 0 1rem; color: #0f172a;">${r.title}</h2>
                        <div style="line-height: 1.85; font-size: 1.12rem;">${r.html || `<p>${(r.plainText || '').replace(/\n+/g, '</p><p>')}</p>`}</div>
                    </article>
                `).join('');
                const fullHtml = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>ארכיון כל תמלולי מניטו (${targetList.length} תמלולים)</title><style>body{font-family:'David Libre','Frank Ruhl Libre',serif;max-width:960px;margin:0 auto;padding:2rem;background:#faf8f5;color:#1e293b;}a{color:#b8860b;text-decoration:none;}a:hover{text-decoration:underline;}</style></head><body><h1>ארכיון תמלולי השיעורים והספרים — הרב יהודא לאון אשכנזי (מניטו) זצ"ל</h1><p>סה"כ ${targetList.length} תמלולים ופרקים מתוך library.manitou.org.il ו-manitou.org.il</p><hr><h3>תוכן עניינים</h3><ol>${tocItems}</ol><hr>${articlesHtml}</body></html>`;
                downloadBlobFile(fullHtml, `manitou-transcripts-anthology-${targetList.length}.html`, 'text/html;charset=utf-8');
                showToast(`🌐 מהדורת HTML מלאה (${targetList.length} תמלולים) הורדה בהצלחה!`);
            });
        }

        if (downloadAllJsonBtn) {
            downloadAllJsonBtn.addEventListener('click', () => {
                const targetList = currentlyFilteredRecords.length > 0 ? currentlyFilteredRecords : combinedRecords;
                downloadBlobFile(JSON.stringify(targetList, null, 2), `manitou-transcripts-${targetList.length}.json`, 'application/json;charset=utf-8');
                showToast(`📊 קובץ JSON של ${targetList.length} תמלולים הורד בהצלחה!`);
            });
        }

        if (syncTranscriptsLiveBtn) {
            syncTranscriptsLiveBtn.addEventListener('click', async () => {
                syncTranscriptsLiveBtn.disabled = true;
                if (syncTranscriptsLiveText) syncTranscriptsLiveText.textContent = 'שואב תמלולים מהאתרים המקוריים...';
                showToast('🔄 מתחיל שאיבה וסנכרון מ-library.manitou.org.il ומ-manitou.org.il...');
                try {
                    const resp = await fetch('/api/transcripts/sync', { method: 'POST' });
                    if (resp.ok) {
                        await loadAllTranscriptRecords(true);
                        showToast(`✅ הסנכרון הושלם! נטענו ${externalRecords.length} תמלולים חיצוניים.`);
                    } else {
                        showToast('⚠️ השרת המקומי סיים עם אזהרה — מציג את המאגר הקיים.');
                        await loadAllTranscriptRecords(true);
                    }
                } catch (e) {
                    showToast('⚠️ לא ניתן להתחבר לשרת הסנכרון המקומי.');
                } finally {
                    syncTranscriptsLiveBtn.disabled = false;
                    if (syncTranscriptsLiveText) syncTranscriptsLiveText.textContent = 'סנכרן מהאתר המקורי';
                }
            });
        }

        window.openTranscriptsModal = async function() {
            await loadAllTranscriptRecords(false);
            transcriptsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.filterInlineTranscripts = async function(queryText = '', forceSource = null) {
            await loadAllTranscriptRecords(false);
            if (forceSource && activeSourceFilter !== forceSource) {
                activeSourceFilter = forceSource;
                sourcePills.forEach(p => p.classList.toggle('active', p.dataset.source === forceSource));
                populateCategoryFilter();
            }
            if (searchInputEl && searchInputEl.value !== queryText) {
                searchInputEl.value = queryText;
            }
            visibleTranscriptsLimit = 80;
            renderTranscriptsList();
            return currentlyFilteredRecords.length;
        };

        window.jumpToTranscriptRecord = async function(recordId, highlightQuery = '') {
            if (readerMode && readerMode.style.display !== 'none') {
                window.location.hash = '#/';
            }
            await loadAllTranscriptRecords(false);
            let rec = combinedRecords.find(r => String(r.id) === String(recordId));
            if (!rec && !booksAppendedToTranscripts) {
                await ensureBookTranscriptRecordsBuilt();
                rec = combinedRecords.find(r => String(r.id) === String(recordId));
            }
            transcriptsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (rec) {
                openTranscriptPreview(rec, highlightQuery);
            }
        };

        if (navTranscriptsBtn) {
            navTranscriptsBtn.addEventListener('click', () => {
                if (readerMode && readerMode.style.display !== 'none') {
                    window.location.hash = '#/transcripts';
                } else {
                    transcriptsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }

        // Auto-load transcripts archive smoothly right after homepage paint
        setTimeout(() => {
            loadAllTranscriptRecords(false);
        }, 120);
    }

    // --- Homepage Spatial Orientation: Navbar Scroll-Spy, Subtle Side Rail & Shelf Strip ---
    function setupHomepageSpatialNav() {
        const progressBar = document.getElementById('homeScrollProgressBar');
        const backToTopBtn = document.getElementById('homeBackToTopBtn');
        const backToTopPct = document.getElementById('homeBackToTopPct');
        const sideRail = document.getElementById('homeSideRail');
        const railDots = document.querySelectorAll('#homeSideRail .side-rail-dot');
        const navSpyLinks = document.querySelectorAll('#mainNavLinks [data-spy-zone]');
        const shelfChips = document.querySelectorAll('#spatialSeriesJumps .spatial-shelf-chip');
        const seriesJumpsWrap = document.getElementById('spatialSeriesJumps');
        const navLibraryLink = document.getElementById('navLibraryLink');
        const navTranscriptsLink = document.getElementById('navTranscriptsLink');
        const navAdvSearchLink = document.getElementById('navAdvSearchLink');

        const zoneIds = ['homeHeroSection', 'booksSection', 'transcriptsSection'];

        function updateScrollOrientation() {
            if (readerMode && readerMode.style.display !== 'none') {
                if (backToTopBtn) backToTopBtn.classList.remove('visible');
                if (sideRail) sideRail.classList.remove('visible');
                return;
            }
            const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
            const docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const pct = Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)));

            if (progressBar) {
                progressBar.style.width = `${pct}%`;
            }
            if (backToTopBtn) {
                backToTopBtn.classList.toggle('visible', scrollTop > 480);
                if (backToTopPct) backToTopPct.textContent = `${pct}%`;
            }
            if (sideRail) {
                sideRail.classList.toggle('visible', scrollTop > 360);
            }

            // Determine active homepage zone
            let activeZoneId = 'homeHeroSection';
            const triggerLine = 175;
            for (const id of zoneIds) {
                const el = document.getElementById(id);
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                if (rect.top <= triggerLine) {
                    activeZoneId = id;
                }
            }

            // Update subtle side-rail dots
            railDots.forEach(dot => {
                dot.classList.toggle('active', dot.dataset.zoneTarget === activeZoneId);
            });

            // Sync Navbar primary links with current scroll zone (only when no modal route is open)
            const currentHash = window.location.hash || '#/';
            if (currentHash === '#/' || currentHash === '#/transcripts' || currentHash === '#/advanced-search' || currentHash === '') {
                const mappedNavZone = activeZoneId === 'homeHeroSection' ? 'booksSection' : activeZoneId;
                navSpyLinks.forEach(link => {
                    link.classList.toggle('active', link.dataset.spyZone === mappedNavZone);
                });
            }

            // Highlight active bookshelf chip when browsing shelves
            if (seriesJumpsWrap) {
                let activeShelfId = null;
                if (activeZoneId === 'booksSection' || activeZoneId === 'homeHeroSection') {
                    document.querySelectorAll('.bookshelf-group[data-shelf-id]').forEach(shelfEl => {
                        const r = shelfEl.getBoundingClientRect();
                        if (r.top <= 240 && r.bottom >= 160) {
                            activeShelfId = shelfEl.dataset.shelfId;
                        }
                    });
                }
                shelfChips.forEach(chip => {
                    chip.classList.toggle('active', chip.dataset.shelfId === activeShelfId);
                });
            }
        }

        window.addEventListener('scroll', updateScrollOrientation, { passive: true });
        window.addEventListener('resize', updateScrollOrientation, { passive: true });
        setTimeout(updateScrollOrientation, 200);

        if (backToTopBtn) {
            backToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Smooth scroll when clicking Navbar section links even if hash hasn't changed
        if (navLibraryLink) {
            navLibraryLink.addEventListener('click', (e) => {
                if (!readerMode || readerMode.style.display === 'none') {
                    e.preventDefault();
                    history.replaceState(null, '', '#/');
                    const booksEl = document.getElementById('booksSection');
                    if (booksEl) booksEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }
        if (navTranscriptsLink) {
            navTranscriptsLink.addEventListener('click', (e) => {
                if (!readerMode || readerMode.style.display === 'none') {
                    e.preventDefault();
                    history.replaceState(null, '', '#/transcripts');
                    const trEl = document.getElementById('transcriptsSection');
                    if (trEl) trEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }
        if (navAdvSearchLink) {
            navAdvSearchLink.addEventListener('click', (e) => {
                if (!readerMode || readerMode.style.display === 'none') {
                    e.preventDefault();
                    history.replaceState(null, '', '#/advanced-search');
                    const advEl = document.getElementById('advancedSearchSection');
                    const advIn = document.getElementById('advSearchInput');
                    if (advEl) advEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    if (advIn) setTimeout(() => advIn.focus(), 450);
                }
            });
        }

        railDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const targetId = dot.dataset.zoneTarget;
                if (targetId === 'homeHeroSection') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        shelfChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const shelfId = chip.dataset.shelfId;
                if (!shelfId) return;

                let shelfEl = document.querySelector(`.bookshelf-group[data-shelf-id="${shelfId}"]`);
                if (!shelfEl) {
                    libraryViewMode = 'shelves';
                    localStorage.setItem('manitou_library_view_mode', 'shelves');
                    if (seriesFilterSelect) seriesFilterSelect.value = 'all';
                    tabs.forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
                    filterBooks('all', '');
                    shelfEl = document.querySelector(`.bookshelf-group[data-shelf-id="${shelfId}"]`);
                }
                if (shelfEl) {
                    if (shelfEl.classList.contains('is-collapsed')) {
                        shelfEl.classList.remove('is-collapsed');
                        collapsedShelves.delete(shelfId);
                        localStorage.setItem('manitou_collapsed_shelves', JSON.stringify(Array.from(collapsedShelves)));
                    }
                    shelfEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    shelfEl.classList.remove('shelf-flash-highlight');
                    void shelfEl.offsetWidth;
                    shelfEl.classList.add('shelf-flash-highlight');
                }
            });
        });
    }

    setupGlossaryModal();
    setupTopicsModal();
    setupQuickSearch();
    setupTimeline();
    setupQuoteStudio();
    setupStudyStreak();
    setupAiAssistant();
    setupTranscriptsCenter();
    setupHomepageSpatialNav();
    
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
            response = await fetch('data/catalog.json?v=16');
        }
        if (response.ok) {
            books = await response.json();
        } else {
            console.error('Failed to load books catalog from both API and static fallback');
        }
    } catch (e) {
        console.warn('API call failed, trying static catalog.json fallback...', e);
        try {
            const response = await fetch('data/catalog.json?v=16');
            if (response.ok) {
                books = await response.json();
            }
        } catch (fallbackError) {
            console.error('Fallback static fetch failed:', fallbackError);
        }
    }
    // Filter out non-book category banner placeholder (id === 1 "ספרים מקוונים")
    if (Array.isArray(books)) {
        books = books.filter(b => !(Number(b.id) === 1 && b.title === 'ספרים מקוונים'));
    }
    initApp();

    // Central Runtime Configuration (populated by /config.js from config.json, with static fallback)
    const runtimeConfig = Object.assign(
        {
            port: Number(window.location.port) || 3090,
            host: window.location.hostname || 'localhost',
            version: null,
            cacheName: null
        },
        window.__MANITOU_CONFIG__ || {}
    );
    const offlineBannerTitleEl = document.getElementById('serverOfflineBannerTitle');
    if (offlineBannerTitleEl) {
        offlineBannerTitleEl.textContent = `השרת המקומי אינו פועל (Port ${runtimeConfig.port} כבוי)!`;
    }

    // Register Service Worker for Offline PWA support and purge any legacy caches
    if ('caches' in window && runtimeConfig.cacheName) {
        caches.keys().then(keys => {
            keys.forEach(k => {
                if (k !== runtimeConfig.cacheName) {
                    caches.delete(k).catch(() => {});
                }
            });
        }).catch(() => {});
    }
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.update().catch(() => {});
        }).catch(() => {});
    }

    // Live Local Server Health Monitor (reads port & version dynamically from config.json via /api/ping)
    let lastKnownServerOnline = true;
    const isLocalhostEnv = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    async function checkLocalServerHealth(manualRetry = false) {
        const banner = document.getElementById('serverOfflineBanner');
        const pill = document.getElementById('navServerStatusPill');
        const pillText = document.getElementById('navServerStatusText');
        if (!isLocalhostEnv) {
            if (banner) banner.style.display = 'none';
            if (pill) pill.style.display = 'none';
            return true;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        try {
            const res = await fetch(`/api/ping?_t=${Date.now()}`, {
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timer);
            if (!res.ok) throw new Error('Ping non-200');
            const pingData = await res.json().catch(() => ({}));
            if (pingData.version && runtimeConfig.version && pingData.version !== runtimeConfig.version && !sessionStorage.getItem('manitou_upgraded_' + pingData.version)) {
                sessionStorage.setItem('manitou_upgraded_' + pingData.version, '1');
                if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
                    await Promise.all(regs.map(r => r.unregister().catch(() => {})));
                }
                if ('caches' in window) {
                    const keys = await caches.keys().catch(() => []);
                    await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
                }
                window.location.reload();
                return true;
            }
            if (banner) banner.style.display = 'none';
            if (pill) {
                pill.style.display = 'none';
                pill.classList.remove('is-offline');
                pill.classList.add('is-online');
            }
            if (!lastKnownServerOnline || manualRetry) {
                lastKnownServerOnline = true;
                if (manualRetry) {
                    window.location.reload();
                }
            }
            return true;
        } catch (err) {
            clearTimeout(timer);
            lastKnownServerOnline = false;
            if (banner) banner.style.display = 'block';
            if (pill) {
                pill.style.display = 'inline-flex';
                pill.classList.remove('is-online');
                pill.classList.add('is-offline');
                pill.title = 'השרת המקומי כבוי! הפעל את ManitouServer.app או node server.js';
            }
            if (pillText) pillText.textContent = 'שרת כבוי';
            return false;
        }
    }
    window.checkLocalServerHealth = checkLocalServerHealth;

    const retryServerConnBtn = document.getElementById('retryServerConnBtn');
    if (retryServerConnBtn) {
        retryServerConnBtn.addEventListener('click', () => checkLocalServerHealth(true));
    }
    const navServerStatusPill = document.getElementById('navServerStatusPill');
    if (navServerStatusPill) {
        navServerStatusPill.addEventListener('click', () => checkLocalServerHealth(true));
    }
    checkLocalServerHealth(false);
    setInterval(() => checkLocalServerHealth(false), 6000);
    window.addEventListener('focus', () => checkLocalServerHealth(false));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
