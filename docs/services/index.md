# Services

```mermaid
graph LR
  mobile[mobile] --> mcp_server[mcp-server]
  mobile[mobile] --> pdf_parser[pdf_parser]
  mobile[mobile] --> shared[shared]
  mobile[mobile] --> webapp[webapp]
  shared[shared] --> mcp_server[mcp-server]
  shared[shared] --> mobile[mobile]
  shared[shared] --> webapp[webapp]
  pdf_parser[pdf_parser] --> shared[shared]
  pdf_parser[pdf_parser] --> webapp[webapp]
  webapp[webapp] --> mcp_server[mcp-server]
  webapp[webapp] --> mobile[mobile]
  webapp[webapp] --> pdf_parser[pdf_parser]
  webapp[webapp] --> shared[shared]
```

| Service | Path | Language | Public symbols | Open TODOs |
|---|---|---|---|---|
| [mcp-server](ai_ui_pal-mcp-server.md) | `ai_ui_pal/mcp-server` | typescript | 8 | 0 |
| [mobile](mobile.md) | `mobile` | typescript | 537 | 3 |
| [mcp-server](packages-mcp-server.md) | `packages/mcp-server` | typescript | 6 | 0 |
| [shared](packages-shared.md) | `packages/shared` | typescript | 205 | 2 |
| [pdf_parser](services-pdf_parser.md) | `services/pdf_parser` | python | 65 | 4 |
| [webapp](webapp.md) | `webapp` | typescript | 1620 | 11 |

<sub>Generated 2026-07-10 by service-docs. Arrow reads "depends on".</sub>
