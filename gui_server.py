#!/usr/bin/env python3
import os
import sys
import subprocess
import threading
import queue
import webbrowser
import signal
import tkinter as tk
from tkinter import messagebox, font
from tkinter import scrolledtext

# Theme Colors (Premium Editorial Gold & Slate)
BG_MAIN = "#0b0f19"       # Deep slate background
BG_CARD = "#161e2e"       # Card element background
BG_CONSOLE = "#050b14"    # Very dark terminal background
TEXT_MAIN = "#e2e8f0"     # Soft light grey text
TEXT_MUTED = "#94a3b8"    # Muted slate text
ACCENT_GOLD = "#e5c158"   # Gold accent color
COLOR_GREEN = "#10b981"   # Emerald success green
COLOR_RED = "#ef4444"     # Red error/stopped
COLOR_BORDER = "#1e293b"  # Border line slate
COLOR_HOVER_GOLD = "#f5d066"
COLOR_HOVER_RED = "#f87171"
COLOR_HOVER_BTN = "#273549"

class ServerControllerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("מנהל שרת - מכון מניטו")
        self.root.geometry("700x560")
        self.root.configure(bg=BG_MAIN)
        self.root.resizable(True, True)
        
        # Set default font configuration
        self.root.option_add('*font', ('Heebo', 10))
        
        self.process = None
        self.log_queue = queue.Queue()
        self.is_running = False
        
        # Determine working directory
        self.work_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Setup UI styles and variables
        self.setup_styles()
        self.create_widgets()
        
        # Check window close event to clean up node process
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        
        # Start queue polling
        self.root.after(100, self.poll_logs)

    def setup_styles(self):
        self.title_font = font.Font(family="Frank Ruhl Libre", size=20, weight="bold")
        self.subtitle_font = font.Font(family="Heebo", size=10, weight="normal")
        self.section_font = font.Font(family="Heebo", size=11, weight="bold")
        self.btn_font = font.Font(family="Heebo", size=11, weight="bold")
        self.log_font = font.Font(family="Courier", size=10)

    def create_widgets(self):
        # 1. Header Area
        header_frame = tk.Frame(self.root, bg=BG_MAIN, padx=24, pady=20)
        header_frame.pack(fill=tk.X)
        
        # Logo Icon & Title (Align Right for Hebrew RTL flow)
        logo_title_frame = tk.Frame(header_frame, bg=BG_MAIN)
        logo_title_frame.pack(side=tk.RIGHT)
        
        logo_label = tk.Label(
            logo_title_frame, 
            text="🕎", 
            font=("Heebo", 24), 
            fg=ACCENT_GOLD, 
            bg=BG_MAIN
        )
        logo_label.pack(side=tk.RIGHT, padx=(10, 0))
        
        title_text_frame = tk.Frame(logo_title_frame, bg=BG_MAIN)
        title_text_frame.pack(side=tk.RIGHT)
        
        title_label = tk.Label(
            title_text_frame, 
            text="מכון מניטו", 
            font=self.title_font, 
            fg=ACCENT_GOLD, 
            bg=BG_MAIN
        )
        title_label.pack(anchor=tk.NE)
        
        subtitle_label = tk.Label(
            title_text_frame, 
            text="מנהל שרת וארכיון מקומי", 
            font=self.subtitle_font, 
            fg=TEXT_MUTED, 
            bg=BG_MAIN
        )
        subtitle_label.pack(anchor=tk.NE)
        
        # Status Label / Indicator (Align Left)
        status_frame = tk.Frame(header_frame, bg=BG_CARD, padx=12, pady=8, bd=1, relief=tk.SOLID, highlightbackground=COLOR_BORDER)
        status_frame.pack(side=tk.LEFT, pady=5)
        
        self.status_indicator = tk.Frame(status_frame, bg=COLOR_RED, width=12, height=12)
        self.status_indicator.pack(side=tk.LEFT, padx=(0, 8))
        
        self.status_text = tk.Label(
            status_frame, 
            text="שרת כבוי", 
            font=self.btn_font, 
            fg=TEXT_MUTED, 
            bg=BG_CARD
        )
        self.status_text.pack(side=tk.LEFT)

        # Divider line
        divider = tk.Frame(self.root, height=1, bg=COLOR_BORDER)
        divider.pack(fill=tk.X, padx=24)

        # 2. Control Cards Frame
        controls_container = tk.Frame(self.root, bg=BG_MAIN, padx=24, pady=15)
        controls_container.pack(fill=tk.X)
        
        # Card 1: Server Control Actions
        server_card = tk.LabelFrame(
            controls_container, 
            text=" ⚙️ ניהול תהליך ", 
            font=self.section_font,
            fg=ACCENT_GOLD, 
            bg=BG_CARD, 
            bd=1, 
            relief=tk.SOLID,
            padx=15, 
            pady=15,
            highlightbackground=COLOR_BORDER
        )
        server_card.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        
        # Start Server Button
        self.start_btn = tk.Button(
            server_card, 
            text="⚡ הפעל שרת", 
            font=self.btn_font, 
            bg=ACCENT_GOLD, 
            fg=BG_MAIN, 
            activebackground=COLOR_HOVER_GOLD, 
            activeforeground=BG_MAIN,
            bd=0, 
            height=2,
            width=14,
            cursor="hand2",
            highlightthickness=0,
            command=self.start_server
        )
        self.start_btn.pack(side=tk.TOP, fill=tk.X, pady=4)
        
        # Stop Server Button (Disabled initially)
        self.stop_btn = tk.Button(
            server_card, 
            text="🛑 עצור שרת", 
            font=self.btn_font, 
            bg="#374151", 
            fg=TEXT_MAIN, 
            activebackground=COLOR_HOVER_RED, 
            activeforeground=TEXT_MAIN,
            bd=0, 
            height=2,
            width=14,
            state=tk.DISABLED,
            cursor="hand2",
            highlightthickness=0,
            command=self.stop_server
        )
        self.stop_btn.pack(side=tk.TOP, fill=tk.X, pady=4)
        
        # Card 2: Quick Links
        links_card = tk.LabelFrame(
            controls_container, 
            text=" 🌐 קישורים מהירים ", 
            font=self.section_font,
            fg=ACCENT_GOLD, 
            bg=BG_CARD, 
            bd=1, 
            relief=tk.SOLID,
            padx=15, 
            pady=15,
            highlightbackground=COLOR_BORDER
        )
        links_card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        # Open Website
        self.open_site_btn = tk.Button(
            links_card, 
            text="📖 פתח אתר ספרייה", 
            font=self.btn_font, 
            bg=BG_MAIN, 
            fg=TEXT_MAIN, 
            activebackground=COLOR_HOVER_BTN,
            activeforeground=TEXT_MAIN,
            bd=1, 
            height=2,
            cursor="hand2",
            highlightbackground=COLOR_BORDER,
            command=lambda: webbrowser.open("http://localhost:3000")
        )
        self.open_site_btn.pack(side=tk.TOP, fill=tk.X, pady=4)
        
        # Open Admin Panel
        self.open_admin_btn = tk.Button(
            links_card, 
            text="🔑 ממשק ניהול ספרים", 
            font=self.btn_font, 
            bg=BG_MAIN, 
            fg=ACCENT_GOLD, 
            activebackground=COLOR_HOVER_BTN,
            activeforeground=ACCENT_GOLD,
            bd=1, 
            height=2,
            cursor="hand2",
            highlightbackground=COLOR_BORDER,
            command=lambda: webbrowser.open("http://localhost:3000/admin")
        )
        self.open_admin_btn.pack(side=tk.TOP, fill=tk.X, pady=4)

        # 3. Log Console Section
        console_container = tk.Frame(self.root, bg=BG_MAIN, padx=24, pady=5)
        console_container.pack(fill=tk.BOTH, expand=True)
        
        console_header = tk.Frame(console_container, bg=BG_MAIN)
        console_header.pack(fill=tk.X, pady=(0, 5))
        
        console_title = tk.Label(
            console_header, 
            text="📟 קונסולת פלט לוגים", 
            font=self.section_font, 
            fg=TEXT_MUTED, 
            bg=BG_MAIN
        )
        console_title.pack(side=tk.RIGHT)
        
        clear_btn = tk.Button(
            console_header,
            text="🗑️ נקה לוגים",
            font=self.subtitle_font,
            bg=BG_MAIN,
            fg=TEXT_MUTED,
            bd=0,
            cursor="hand2",
            highlightthickness=0,
            command=self.clear_logs
        )
        clear_btn.pack(side=tk.LEFT)
        
        # Log Text Box
        self.log_display = scrolledtext.ScrolledText(
            console_container, 
            bg=BG_CONSOLE, 
            fg=TEXT_MAIN, 
            insertbackground=TEXT_MAIN,
            font=self.log_font,
            bd=1,
            relief=tk.SOLID,
            highlightbackground=COLOR_BORDER,
            padx=12,
            pady=12
        )
        self.log_display.pack(fill=tk.BOTH, expand=True)
        
        # Log coloring tags
        self.log_display.tag_config("info", fg=TEXT_MUTED)
        self.log_display.tag_config("success", fg=COLOR_GREEN, weight="bold")
        self.log_display.tag_config("error", fg=COLOR_RED, weight="bold")
        self.log_display.tag_config("gold", fg=ACCENT_GOLD)
        
        self.log_write("לחץ על 'הפעל שרת' כדי להפעיל את השרת המקומי...\n", "info")
        self.log_display.configure(state=tk.DISABLED)

    def log_write(self, text, tag="info"):
        self.log_display.configure(state=tk.NORMAL)
        self.log_display.insert(tk.END, text, tag)
        self.log_display.see(tk.END)
        self.log_display.configure(state=tk.DISABLED)

    def clear_logs(self):
        self.log_display.configure(state=tk.NORMAL)
        self.log_display.delete("1.0", tk.END)
        self.log_display.configure(state=tk.DISABLED)
        self.log_write("קונסולת הלוגים נוקתה.\n", "info")

    def start_server(self):
        if self.is_running:
            return
            
        self.log_write("\n--- ⚡ מתחיל הפעלת שרת... ---\n", "gold")
        
        server_script = os.path.join(self.work_dir, "server.js")
        if not os.path.exists(server_script):
            self.log_write(f"❌ שגיאה: לא נמצא קובץ השרת {server_script}\n", "error")
            messagebox.showerror("שגיאה", f"לא נמצא קובץ השרת server.js בנתיב:\n{self.work_dir}")
            return
            
        try:
            # Spawn Node subprocess natively under arm64/Apple Silicon if on macOS
            cmd = ["node", "server.js"]
            if sys.platform == "darwin":
                # Ensure child runs natively in Apple Silicon environment if possible
                cmd = ["/usr/bin/arch", "-arm64", "node", "server.js"]

            self.process = subprocess.Popen(
                cmd,
                cwd=self.work_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                preexec_fn=os.setsid if sys.platform != "win32" else None
            )
            
            self.is_running = True
            self.update_ui_state(True)
            
            # Start background thread to read logs
            self.log_thread = threading.Thread(target=self.read_subprocess_output, daemon=True)
            self.log_thread.start()
            
        except Exception as e:
            self.log_write(f"❌ שגיאה בהפעלת השרת: {str(e)}\n", "error")
            messagebox.showerror("שגיאה בהפעלה", f"שגיאה בהפעלת תהליך Node.js:\n{str(e)}")

    def read_subprocess_output(self):
        while self.process and self.is_running:
            line = self.process.stdout.readline()
            if not line:
                break
            self.log_queue.put(line)
        
        # Subprocess finished
        if self.is_running:
            self.root.after(0, self.server_exited_unexpectedly)

    def poll_logs(self):
        # Empty the queue into log display
        while not self.log_queue.empty():
            try:
                line = self.log_queue.get_nowait()
                
                # Tag mapping for colors
                tag = "info"
                lower_line = line.lower()
                if "error" in lower_line or "fail" in lower_line or "exception" in lower_line or "eaddrinuse" in lower_line or "❌" in line:
                    tag = "error"
                elif "running" in lower_line or "success" in lower_line or "פעיל" in line:
                    tag = "success"
                elif "server" in lower_line or "http" in lower_line or "🕎" in line:
                    tag = "gold"
                    
                self.log_write(line, tag)
            except queue.Empty:
                break
        
        self.root.after(100, self.poll_logs)

    def stop_server(self):
        if not self.is_running or not self.process:
            return
            
        self.log_write("\n--- 🛑 מכבה את השרת... ---\n", "gold")
        try:
            # Kill process group (handles any children processes)
            if sys.platform != "win32":
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            else:
                self.process.terminate()
                
            self.process.wait(timeout=3)
        except Exception as e:
            self.log_write(f"⚠️ אזהרה בעת הכיבוי: {str(e)}. מבצע כיבוי כפוי...\n", "error")
            try:
                if sys.platform != "win32":
                    os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                else:
                    self.process.kill()
            except:
                pass
                
        self.process = None
        self.is_running = False
        self.update_ui_state(False)
        self.log_write("🟢 השרת כבוי בהצלחה. ---\n", "success")

    def server_exited_unexpectedly(self):
        return_code = self.process.poll() if self.process else -1
        self.log_write(f"\n❌ השרת הפסיק לפעול באופן לא צפוי (קוד יציאה: {return_code})\n", "error")
        self.process = None
        self.is_running = False
        self.update_ui_state(False)

    def update_ui_state(self, running):
        if running:
            self.status_indicator.configure(bg=COLOR_GREEN)
            self.status_text.configure(text="שרת פעיל בפורט 3000", fg=COLOR_GREEN)
            self.start_btn.configure(state=tk.DISABLED, bg="#1e293b", fg=TEXT_MUTED)
            self.stop_btn.configure(state=tk.NORMAL, bg=COLOR_RED, fg=TEXT_MAIN)
        else:
            self.status_indicator.configure(bg=COLOR_RED)
            self.status_text.configure(text="שרת כבוי", fg=TEXT_MUTED)
            self.start_btn.configure(state=tk.NORMAL, bg=ACCENT_GOLD, fg=BG_MAIN)
            self.stop_btn.configure(state=tk.DISABLED, bg="#1e293b", fg=TEXT_MUTED)

    def on_close(self):
        if self.is_running:
            if messagebox.askyesno("יציאה", "השרת עדיין פעיל. האם לסגור את האפליקציה ולכבות את השרת?"):
                self.stop_server()
                self.root.destroy()
        else:
            self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = ServerControllerApp(root)
    root.mainloop()
