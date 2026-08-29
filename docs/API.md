# API

REST under `/api/v1`. Organisation access derived from authenticated context — never trust client-supplied `organization_id` without authorization.

Error format:

```json
{
  "error": {
    "code": "INVOICE_ALREADY_ISSUED",
    "message": "This invoice has already been issued.",
    "details": {}
  }
}
```

See SPEC §81–§82.
