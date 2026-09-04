-- Real dispatch attempts, distinct from the "prepared, not sent" preview
-- (application_events already records the higher-level lifecycle; this
-- table is the detailed audit record the spec calls for: recipient,
-- subject, attachments, timestamp, attempt outcome).
CREATE TABLE email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  recipient citext NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_deliveries_application ON email_deliveries(application_id);

ALTER TABLE application_events DROP CONSTRAINT application_events_event_type_check;
ALTER TABLE application_events ADD CONSTRAINT application_events_event_type_check CHECK (event_type IN (
  'created', 'reviewed', 'signed', 'email_prepared', 'print_prepared', 'status_changed',
  'email_sent', 'email_send_failed'
));
