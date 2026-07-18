-- The sandbox sometimes uses null for nested error details. Rows received after
-- the first repair migration could therefore still be classified as an invalid
-- response even though they contain a complete synchronous rejection.

update public.e_invoice_submission_documents document
set accepted = false,
    status = 'failed',
    rejection_error = rejected.item->'error'
from public.e_invoice_submissions submission,
     lateral jsonb_array_elements(submission.raw_response->'rejectedDocuments') rejected(item)
where document.submission_id = submission.id
  and document.invoice_code_number = rejected.item->>'invoiceCodeNumber'
  and submission.http_status = 202
  and submission.error_code = 'invalid_response'
  and jsonb_array_length(coalesce(submission.raw_response->'acceptedDocuments', '[]'::jsonb)) = 0;

update public.e_invoice_submissions
set error_code = coalesce(
      raw_response->'rejectedDocuments'->0->'error'->>'errorCode',
      raw_response->'rejectedDocuments'->0->'error'->>'code',
      'submission_rejected'
    ),
    error_message = coalesce(
      raw_response->'rejectedDocuments'->0->'error'->>'error',
      raw_response->'rejectedDocuments'->0->'error'->>'message',
      'MyInvois rejected every document during synchronous validation.'
    ),
    retry_after = null
where http_status = 202
  and error_code = 'invalid_response'
  and coalesce(raw_response->>'submissionUID', raw_response->>'submissionUid') is null
  and jsonb_array_length(coalesce(raw_response->'acceptedDocuments', '[]'::jsonb)) = 0
  and jsonb_array_length(coalesce(raw_response->'rejectedDocuments', '[]'::jsonb)) > 0;
