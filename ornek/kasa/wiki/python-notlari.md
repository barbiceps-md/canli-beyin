---
alan: yazilim
guncelleme: 2026-10-22
---

# Python Notları

## Küçük kalıplar
```python
from pathlib import Path
notlar = sorted(Path("notlar").rglob("*.md"))
print(len(notlar), "not")
```

- `json.dump(..., ensure_ascii=False)` Türkçe harfleri bozmaz.
- Betikleri `python -I` ile çalıştırmak yerel dosyaların içe aktarılmasını önler.

İlgili: [[git-ipuclari]] · [[ev-sunucusu]]; eski notlar [[python-notlari-gecmis]].
