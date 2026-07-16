# MyInvois UBL fixtures

`internal/` contains canonical NiagaAI domain fixtures. `expected-ubl/` contains checked-in UBL JSON golden files produced by the supported mapper and reviewed as intentional wire-format expectations.

Session 6 maps standard Invoice v1.1 documents. B2B, B2C, tax-exempt, multiple-tax-group, document-discount and foreign-buyer inputs are supported. Self-billed invoice and credit-note fixtures remain explicitly pending until dedicated document-type mappers are introduced; the registry must reject those combinations instead of emitting an incomplete payload.

Golden files must be updated only after reviewing the field mapping and documenting the intentional payload change.

