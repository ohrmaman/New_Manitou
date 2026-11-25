import os
import ssl
import time
import urllib.parse
import urllib.request

OUT_DIR = '/Users/ormaman/New_Manitou/comics/chapter1_book/images'
os.makedirs(OUT_DIR, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

SCENES = [
    (
        'cover.png',
        768, 1024, 201,
        "Vibrant Pixar and Studio Ghibli animated fantasy storybook cover art, glowing warm golden light, starry royal-blue sky, magical golden archway portal, joyful 8-year-old boy with curly brown hair and small blue kippah and 6-year-old girl with braids in yellow dress looking amazed at a glowing open ancient blue book with a tiny magical blue-and-gold songbird flying out of the light, colorful cinematic illustration, no text"
    ),
    (
        'page1_panel1.png',
        1024, 576, 202,
        "Vibrant Pixar and Studio Ghibli animated fantasy comic panel, cozy warm Jerusalem stone living room on Friday afternoon, golden sunlight through arched window, kind smiling grandfather with white beard and glasses handing a glowing ancient deep-blue book across a wooden table to two happy curious kids (8-year-old boy in sky-blue sweater with small blue kippah and 6-year-old girl with braids in yellow dress), rich colorful storybook art, no text"
    ),
    (
        'page1_panel2.png',
        1024, 576, 203,
        "Vibrant Pixar and Studio Ghibli animated fantasy comic panel, magical golden fountain of swirling stardust and sparkling light bursting out of an open ancient blue book on a wooden table, an adorable glowing sapphire-blue songbird with luminous golden wings flying out of the light, two delighted children gazing up in pure wonder bathed in warm golden glow, colorful cinema lighting, no text"
    ),
    (
        'page2_panel1.png',
        1024, 576, 204,
        "Vibrant Pixar and Studio Ghibli animated fantasy comic panel, boundless dazzling ocean of warm golden-white cosmic light clouds, two playful kids (8-year-old boy in sky-blue sweater with small kippah and 6-year-old girl in yellow dress) floating weightlessly in zero gravity wearing cute oversized dark sunglasses against the bright light, next to a smiling magical blue-and-gold songbird, joyful whimsical art, no text"
    ),
    (
        'page2_panel2.png',
        1024, 576, 205,
        "Breathtaking Pixar and Studio Ghibli cosmic fantasy comic panel, radiant golden light curtains pulling gently back toward the edges to reveal a vast peaceful circular deep sapphire-blue starry night space in the center, one single warm glowing golden spark shining softly in the exact center with gentle golden ripples, two amazed children and a magical blue-and-gold bird watching in awe from the corner, cinematic fantasy art, no text"
    ),
    (
        'page3_panel1.png',
        1024, 576, 206,
        "Breathtaking Pixar and Studio Ghibli fantasy comic panel, inside a starry midnight-blue cosmos floats a grand luminous golden archway shaped like a welcoming glowing house portal, a warm straight beam of golden light flowing out into the starry space, two excited kids (boy in sky-blue sweater and girl in yellow dress) and a glowing blue-and-gold songbird floating nearby marveling at the golden beam, vibrant fantasy art, no text"
    ),
    (
        'page3_panel2.png',
        1024, 576, 207,
        "Heartwarming Pixar and Studio Ghibli fantasy comic panel, close-up in starry midnight-blue space, a joyful 6-year-old girl with dark braids in a yellow dress gently reaching her fingertip toward a tiny floating warm golden spark that blooms with soft golden stardust rings, her smiling 8-year-old brother and a tiny magical blue-and-gold bird beside her bathed in warm golden glow, rich painterly storybook art, no text"
    ),
    (
        'page4_panel1.png',
        1024, 576, 208,
        "Epic Pixar and Studio Ghibli fantasy comic splash panel, seen from behind, two children (8-year-old boy in blue sweater and 6-year-old girl in yellow dress) standing hand in hand on a glowing golden starry balcony overlooking a breathtaking swirling sunrise nebula of creation with golden clouds, turquoise stardust, and emerging mountains and ocean on the horizon, a magical blue-and-gold songbird soaring ahead into the dawn, no text"
    ),
    (
        'back_cover.png',
        768, 768, 209,
        "Serene Pixar and Studio Ghibli storybook illustration, starry deep-blue night sky with glowing golden crescent moon over warm Jerusalem stone rooftops, a magical sapphire-blue songbird with luminous golden wings flying gracefully leaving golden stardust over an open blue leather book on a stone balcony, dreamy fantasy art, no text"
    ),
]


def download_one(item):
    fname, w, h, seed, prompt = item
    out_path = os.path.join(OUT_DIR, fname)
    if os.path.exists(out_path) and os.path.getsize(out_path) > 30000:
        print(f'[SKIP] {fname} already exists', flush=True)
        return True
    encoded = urllib.parse.quote(prompt)
    url = f'https://image.pollinations.ai/prompt/{encoded}?width={w}&height={h}&seed={seed}&nologo=true'
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=90) as resp:
                ctype = resp.headers.get('Content-Type', '')
                data = resp.read()
                if len(data) > 15000 and ('image' in ctype or data[:4] in (b'\x89PNG', b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'RIFF')):
                    with open(out_path, 'wb') as f:
                        f.write(data)
                    print(f'[OK] {fname} ({len(data)} bytes, {ctype})', flush=True)
                    return True
                else:
                    print(f'[WARN] {fname}: unexpected ({len(data)} bytes, {ctype})', flush=True)
        except Exception as e:
            print(f'[WAIT] {fname} attempt {attempt+1}: {e} -> waiting 26s...', flush=True)
        time.sleep(26)
    return False


def main():
    t0 = time.time()
    ok = 0
    for item in SCENES:
        out_path = os.path.join(OUT_DIR, item[0])
        existed = os.path.exists(out_path) and os.path.getsize(out_path) > 30000
        if download_one(item):
            ok += 1
        if not existed:
            time.sleep(26)
    print(f'Done in {round(time.time() - t0, 1)}s: {ok}/{len(SCENES)} images generated!', flush=True)


if __name__ == '__main__':
    main()
