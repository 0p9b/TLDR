---
description: Compress natural language files into TLDR format to save input tokens
---
Compress the file: $ARGUMENTS.

First check if file is text/prose (.md, .txt). If code, skip.
Keep structure, code, URLs, paths, and identifiers.
Drop articles, filler, pleasantries, hedging.
Save backup to FILE.original.md, overwrite original with compressed.
