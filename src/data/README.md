# Word data

`valid-words.txt` was generated from the Brazilian Portuguese word list in
`pythonprobr/palavras`, which is based on the LibreOffice PT-BR spelling
dictionary.

Source: https://github.com/pythonprobr/palavras
License: MPL-2.0

Generation notes:
- normalized words to uppercase ASCII;
- removed accents and diacritics;
- kept only words with exactly five letters from A-Z;
- sorted and deduplicated the result.
