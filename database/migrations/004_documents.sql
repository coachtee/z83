CREATE TABLE document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code IN (
    'id_document', 'matric_certificate', 'qualification_certificate', 'cv',
    'drivers_licence', 'professional_registration', 'other', 'z83_form_template'
  )),
  label text NOT NULL,
  requires_certification boolean NOT NULL DEFAULT false
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES document_types(id),
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON documents(owner_user_id) WHERE deleted_at IS NULL;
