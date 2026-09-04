CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vacancy_id uuid NOT NULL REFERENCES vacancies(id),
  snapshot_id uuid,
  status text NOT NULL CHECK (status IN (
    'draft', 'reviewed', 'signed', 'email_prepared', 'print_prepared', 'submitted', 'closed'
  )) DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One Z83 per position: a user may only hold one non-closed application per vacancy.
CREATE UNIQUE INDEX idx_applications_one_open_per_vacancy
  ON applications(user_id, vacancy_id) WHERE status <> 'closed';

CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_vacancy ON applications(vacancy_id);

CREATE TABLE application_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE applications
  ADD CONSTRAINT fk_applications_snapshot
  FOREIGN KEY (snapshot_id) REFERENCES application_snapshots(id);

CREATE TABLE application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id),
  document_role text NOT NULL CHECK (document_role IN (
    'id', 'certificate', 'cv', 'registration', 'generated_z83', 'other'
  )),
  storage_key text,
  order_index smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_application_documents_source CHECK (document_id IS NOT NULL OR storage_key IS NOT NULL)
);

CREATE INDEX idx_application_documents_application ON application_documents(application_id);

CREATE TABLE application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'reviewed', 'signed', 'email_prepared', 'print_prepared', 'status_changed'
  )),
  actor_user_id uuid REFERENCES users(id),
  actor_role text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_events_application ON application_events(application_id);

CREATE TABLE signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  image_storage_key text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE INDEX idx_signatures_application ON signatures(application_id);
