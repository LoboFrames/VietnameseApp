#!/bin/bash
# ============================================================
#  DailyViet — Process Lesson Images
# ============================================================
#  Double-click this any time after adding new ChatGPT images
#  to the images folder. No terminal typing required.
#
#  Just drop your images in named lesson_<number> — any case,
#  .png or .jpg, doesn't need to be exact (Lesson_24.png,
#  lesson5.jpeg, LESSON_07.PNG all work). This will:
#    1. Find every image meant for a lesson
#    2. Resize/compress it to match what the app expects
#    3. Rename it to the exact filename the app looks for
#       (lesson_01.jpg ... lesson_62.jpg)
#    4. Move the old raw files out of the way into
#       images/_to_delete/
#    5. Tell you exactly which lessons still need an image
# ============================================================

cd "$(dirname "$0")"

PY="python3"
command -v python3 >/dev/null 2>&1 || PY="python"

"$PY" process_lesson_images.py

echo ""
read -p "Press Enter to close this window..."
