CREATE INDEX ix_career_talk_person_archived_held ON career_talk (person_id, archived_at, held_at, id);
CREATE INDEX ix_task_archived_status_due ON task (archived_at, status, due_at);
CREATE INDEX ix_raise_request_archived_status ON raise_request (archived_at, status);
