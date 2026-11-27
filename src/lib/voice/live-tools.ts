import type { FunctionTool } from "openai/resources/live/live";

/**
 * Function tools declared on the Live session. The delegated Responses model
 * calls them; the browser executes the matching handler from
 * `createVoiceClientTools`, so names here must match that map exactly.
 */
export const VOICE_LIVE_TOOLS: readonly FunctionTool[] = [
  {
    "type": "function",
    "name": "create_transaction_draft",
    "description": "Stage a new income or expense the owner just described. It does not save the record—it appears in the on-screen review queue. Always read the parsed summary back and ask the owner to confirm before calling confirm_transaction.",
    "parameters": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "description": "\"income\" for money in, \"expense\" for money out."
        },
        "amount": {
          "type": "number",
          "description": "The amount in MYR ringgit. Never invent this; ask if unclear."
        },
        "description": {
          "type": "string",
          "description": "What the transaction was for."
        },
        "category": {
          "type": "string",
          "description": "A short category such as Fuel, Supplies, Sales."
        },
        "counterpartyName": {
          "type": "string",
          "description": "The merchant or customer name, if mentioned."
        },
        "paymentMethod": {
          "type": "string",
          "description": "How it was paid: cash, bank transfer, card, e-wallet, or credit."
        },
        "date": {
          "type": "string",
          "description": "ISO date YYYY-MM-DD. Resolve relative dates against today's date from your instructions (Asia/Kuala_Lumpur)."
        },
        "taxRate": {
          "type": "number",
          "description": "SST percentage if mentioned, e.g. 6. Default 0."
        },
        "taxInclusive": {
          "type": "boolean",
          "description": "True if the amount already includes tax, false if tax is added on top."
        },
        "quantity": {
          "type": "number",
          "description": "Quantity of items, if mentioned."
        },
        "unit": {
          "type": "string",
          "description": "Unit of the quantity, if mentioned."
        },
        "notes": {
          "type": "string",
          "description": "Any extra note the owner adds."
        }
      },
      "required": [
        "type"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "update_transaction_draft",
    "description": "Correct one or more fields on the transaction currently staged for review. Use when the owner fixes a value by voice.",
    "parameters": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "description": "\"income\" or \"expense\"."
        },
        "amount": {
          "type": "number",
          "description": "New amount in MYR."
        },
        "description": {
          "type": "string",
          "description": "New description."
        },
        "category": {
          "type": "string",
          "description": "New category."
        },
        "counterpartyName": {
          "type": "string",
          "description": "New merchant or customer."
        },
        "paymentMethod": {
          "type": "string",
          "description": "New payment method."
        },
        "date": {
          "type": "string",
          "description": "New ISO date YYYY-MM-DD."
        },
        "taxRate": {
          "type": "number",
          "description": "New SST percentage."
        },
        "taxInclusive": {
          "type": "boolean",
          "description": "Whether the amount includes tax."
        },
        "notes": {
          "type": "string",
          "description": "New note."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "confirm_transaction",
    "description": "Persist the staged transaction to the owner's records. Only call this after the owner explicitly confirms. Do not claim the record is saved unless this returns success.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "discard_draft",
    "description": "Discard the currently staged draft without saving it.",
    "parameters": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "description": "\"transaction\", \"invoice\", or \"all\"."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "query_finances",
    "description": "Answer a question about the owner's numbers over a period. All arithmetic is computed locally; read the returned figures verbatim.",
    "parameters": {
      "type": "object",
      "properties": {
        "period": {
          "type": "string",
          "description": "One of: today, yesterday, this_week, this_month, last_month, this_year, all."
        },
        "metric": {
          "type": "string",
          "description": "One of: summary, profit, income, expenses, biggest_expense, cash_in, cash_out."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "get_business_snapshot",
    "description": "Give a quick health check: this month's money in and out, estimated profit, unpaid invoices, and drafts waiting for review.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "get_business_context",
    "description": "Report which e-invoice details the business still needs (TIN, SST registration, MSIC code, address, registration number).",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "list_invoices",
    "description": "Read back the most recent invoices with their totals and statuses.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "list_recent_transactions",
    "description": "Read back the owner's most recent records.",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "How many records to read back, 1 to 10. Default 5."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "find_transactions",
    "description": "Search saved records by amount, description, category, or counterparty. Use this before editing or deleting a record to identify it. The result includes each record's id in square brackets.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "What to search for, e.g. \"45 petrol\" or a customer name."
        },
        "type": {
          "type": "string",
          "description": "Filter by \"income\" or \"expense\"."
        },
        "limit": {
          "type": "number",
          "description": "Maximum matches, 1 to 10."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "edit_transaction",
    "description": "Load a saved record into the review queue for editing. Provide the record id from find_transactions, or a query to identify it. After loading, use update_transaction_draft then confirm_transaction.",
    "parameters": {
      "type": "object",
      "properties": {
        "transactionId": {
          "type": "string",
          "description": "The record id from find_transactions."
        },
        "query": {
          "type": "string",
          "description": "A description or amount to identify the record if you don't have the id."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "delete_transaction",
    "description": "Stage a record for deletion. This does NOT delete it — you must read the record back and get explicit confirmation, then call confirm_delete.",
    "parameters": {
      "type": "object",
      "properties": {
        "transactionId": {
          "type": "string",
          "description": "The record id from find_transactions."
        },
        "query": {
          "type": "string",
          "description": "A description or amount to identify the record if you don't have the id."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "confirm_delete",
    "description": "Permanently delete the record staged by delete_transaction. Only call after the owner explicitly confirms the deletion.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "search_customers",
    "description": "Look up saved customers by name. Returns matching names with their TIN where known.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The customer name to search for."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "create_customer",
    "description": "Stage a new customer for review. Does NOT save it — read it back and call confirm_customer after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The customer or business name."
        },
        "tin": {
          "type": "string",
          "description": "The customer's tax identification number, if known."
        },
        "email": {
          "type": "string",
          "description": "The customer's email, if known."
        },
        "phone": {
          "type": "string",
          "description": "The customer's phone number, if known."
        },
        "registrationNumber": {
          "type": "string",
          "description": "The business registration number (BRN), if known."
        },
        "address": {
          "type": "string",
          "description": "The customer's address, if mentioned."
        }
      },
      "required": [
        "name"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "confirm_customer",
    "description": "Save the customer staged by create_customer. Only call after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "list_receivables",
    "description": "Report who owes the owner money on issued invoices, highlighting overdue ones.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "draft_reminder",
    "description": "Draft a friendly payment reminder for an outstanding invoice and put it in the review queue. Read the draft back; call send_reminder only after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {
        "customerName": {
          "type": "string",
          "description": "The customer to remind."
        },
        "invoiceNumber": {
          "type": "string",
          "description": "The specific invoice number, if given."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "send_reminder",
    "description": "Mark the drafted reminder as sent against its invoice. Call with no parameters to send the staged reminder, or specify a customer or invoice. Only after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {
        "customerName": {
          "type": "string",
          "description": "The customer to remind, if not using the staged draft."
        },
        "invoiceNumber": {
          "type": "string",
          "description": "The invoice number, if not using the staged draft."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "record_invoice_payment",
    "description": "Stage a payment received against an outstanding invoice. Does NOT save it — read it back and call confirm_invoice_payment after the owner confirms. Overpayments are rejected.",
    "parameters": {
      "type": "object",
      "properties": {
        "customerName": {
          "type": "string",
          "description": "The customer who paid."
        },
        "invoiceNumber": {
          "type": "string",
          "description": "The invoice number, if given."
        },
        "amount": {
          "type": "number",
          "description": "Amount paid in MYR. Defaults to the full outstanding amount if not given."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "confirm_invoice_payment",
    "description": "Record the staged payment against the invoice, updating its status. Only call after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "create_invoice_draft",
    "description": "Stage a new e-invoice for review. Provide the customer name and line items. A known customer's TIN and email are attached automatically. Does NOT save it — call confirm_invoice after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {
        "customerName": {
          "type": "string",
          "description": "The customer to invoice."
        },
        "items": {
          "type": "string",
          "description": "A JSON string array of line items, e.g. [{\"description\":\"Kraf bag\",\"quantity\":3,\"unitPrice\":30,\"taxRate\":6}]. taxRate is the SST percentage."
        },
        "customerEmail": {
          "type": "string",
          "description": "Override the customer email, if given."
        },
        "buyerTin": {
          "type": "string",
          "description": "Override the buyer TIN, if given."
        },
        "issueDate": {
          "type": "string",
          "description": "Issue date YYYY-MM-DD. Defaults to today."
        },
        "dueDate": {
          "type": "string",
          "description": "Due date YYYY-MM-DD. Defaults to 14 days after issue."
        },
        "paymentTerms": {
          "type": "string",
          "description": "Payment terms text."
        },
        "notes": {
          "type": "string",
          "description": "Any note for the invoice."
        }
      },
      "required": [
        "customerName",
        "items"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "update_invoice_draft",
    "description": "Change details on the staged invoice: customer, dates, payment terms, prepayment, or notes.",
    "parameters": {
      "type": "object",
      "properties": {
        "customerName": {
          "type": "string",
          "description": "New customer name (re-links their TIN and email)."
        },
        "issueDate": {
          "type": "string",
          "description": "New issue date YYYY-MM-DD."
        },
        "dueDate": {
          "type": "string",
          "description": "New due date YYYY-MM-DD."
        },
        "paymentTerms": {
          "type": "string",
          "description": "New payment terms."
        },
        "prepaymentAmount": {
          "type": "number",
          "description": "Prepayment amount in MYR."
        },
        "notes": {
          "type": "string",
          "description": "New note."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "add_invoice_line_item",
    "description": "Add a line item to the staged invoice and report the new total.",
    "parameters": {
      "type": "object",
      "properties": {
        "description": {
          "type": "string",
          "description": "What the line item is."
        },
        "quantity": {
          "type": "number",
          "description": "Quantity."
        },
        "unitPrice": {
          "type": "number",
          "description": "Unit price in MYR."
        },
        "taxRate": {
          "type": "number",
          "description": "SST percentage for the line, e.g. 6. Default 0."
        }
      },
      "required": [
        "description",
        "quantity",
        "unitPrice"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "remove_invoice_line_item",
    "description": "Remove a line item from the staged invoice by its description or position. The invoice must keep at least one line.",
    "parameters": {
      "type": "object",
      "properties": {
        "description": {
          "type": "string",
          "description": "The description of the line to remove."
        },
        "index": {
          "type": "number",
          "description": "The 1-based position of the line to remove."
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "confirm_invoice",
    "description": "Save the staged invoice as a draft e-invoice with a sequential invoice number. Only call after the owner confirms.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "navigate",
    "description": "Open a page in the app for the owner, optionally deep-linking to a tab or section. destination is one of: dashboard, records, new expense, invoices, new invoice, e-invoices, reminders, cash flow, loan readiness, settings, inventory, voice.",
    "parameters": {
      "type": "object",
      "properties": {
        "destination": {
          "type": "string",
          "description": "Where to go, e.g. \"dashboard\", \"invoices\", \"e-invoices\", \"cash flow\", \"settings\"."
        },
        "tab": {
          "type": "string",
          "description": "Optional e-invoices stage: prepare, submit, or history."
        },
        "view": {
          "type": "string",
          "description": "Optional e-invoices preparation filter: needs_information, ready, or approved."
        },
        "section": {
          "type": "string",
          "description": "Optional settings section to scroll to, e.g. business-profile, myinvois-connection."
        }
      },
      "required": [
        "destination"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "get_current_context",
    "description": "Report which business and page the owner is currently viewing, today's date, and anything currently staged on screen for review (a draft transaction, invoice, reminder, pending delete or payment, or new customer). Call this whenever you need to know what the owner is looking at.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "review_in_form",
    "description": "Open the real invoice or transaction form pre-filled with the staged draft so the owner can review and save it on screen. Call after create_invoice_draft / create_transaction_draft when the owner wants to see or finish it in the form.",
    "parameters": {
      "type": "object",
      "properties": {
        "form": {
          "type": "string",
          "description": "Which form to open: \"invoice\" or \"transaction\"."
        }
      },
      "required": [
        "form"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "add_line_to_open_invoice",
    "description": "Add a blank line item to the invoice form the owner currently has open on screen (not the staged draft). Only use when the invoice form is open; then ask for the description, quantity, and price.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "select_ready_e_invoices",
    "description": "Open the e-invoices Submit tab and tick every payload that is ready to submit, so the owner only has to confirm sending. Does not submit anything.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "open_invoice",
    "description": "Open a specific saved invoice's detail page. Match by invoice number (e.g. INV-100) or the customer's name. If several match, read the options back and ask which one.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The invoice number or customer name to open."
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "open_transaction",
    "description": "Open a specific saved transaction (income/expense) detail page. Match by description or merchant/customer name. If several match, read the options back and ask which one.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "A description or merchant name identifying the record."
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "fill_e_invoice_field",
    "description": "On the e-invoices Prepare stage, fill one document field on the currently selected preparation and save it (re-running the checks). Use for blockers like exchange rate or issue time. Read the on-screen result back.",
    "parameters": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "description": "The field name, e.g. \"exchange rate\" or \"issue time\"."
        },
        "value": {
          "type": "string",
          "description": "The value to enter, e.g. \"4.7\" or \"09:30\"."
        }
      },
      "required": [
        "field",
        "value"
      ],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "approve_e_invoice",
    "description": "Approve and freeze the e-invoice preparation that is ready for approval. Approving is irreversible for that revision, so only call after the owner clearly confirms.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "submit_e_invoices",
    "description": "Submit the e-invoice payloads currently selected on the Submit tab to MyInvois. Sensitive — only call after selecting ready payloads (select_ready_e_invoices) and getting the owner's clear confirmation.",
    "parameters": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  }
];
