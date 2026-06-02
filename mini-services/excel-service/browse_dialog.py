"""
Native file/folder picker dialogs (Windows: tkinter).
"""

import os
from typing import Any, Dict, Optional


def _run_tk_dialog(open_func) -> Dict[str, Any]:
    try:
        import tkinter as tk

        root = tk.Tk()
        root.withdraw()
        try:
            root.attributes("-topmost", True)
        except tk.TclError:
            pass
        root.update()
        path = open_func(root)
        root.destroy()
        if path and os.path.exists(path):
            return {"path": os.path.abspath(path)}
        return {"path": None, "cancelled": True}
    except Exception as e:
        return {"error": f"Не удалось открыть диалог выбора: {e}"}


def pick_excel_file(initial_dir: Optional[str] = None) -> Dict[str, Any]:
    from tkinter import filedialog

    def _open(_root):
        return filedialog.askopenfilename(
            title="Выберите файл Excel",
            filetypes=[
                ("Excel", "*.xlsx *.xlsm *.xltx *.xltm"),
                ("Все файлы", "*.*"),
            ],
            initialdir=initial_dir if initial_dir and os.path.isdir(initial_dir) else None,
        )

    return _run_tk_dialog(_open)


def pick_folder(initial_dir: Optional[str] = None) -> Dict[str, Any]:
    from tkinter import filedialog

    def _open(_root):
        return filedialog.askdirectory(
            title="Выберите папку",
            initialdir=initial_dir if initial_dir and os.path.isdir(initial_dir) else None,
            mustexist=True,
        )

    return _run_tk_dialog(_open)
