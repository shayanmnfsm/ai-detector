# Bundled fonts

The popup uses two variable fonts, both under the SIL Open Font License:

- **Inter** (`inter-latin.woff2`) — Latin UI text
- **Vazirmatn** (`vazirmatn-arabic.woff2`, `vazirmatn-latin.woff2`) — Persian UI text

The `.woff2` files are **not** committed to this repository. Fetch them with:

```sh
bash scripts/fetch-fonts.sh
```

The script downloads the variable-font files from Google Fonts and places them
in this folder. Without them the extension still works — the popup falls back
to system fonts.
